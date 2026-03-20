import { PrismaClient, Prisma } from '@prisma/client';
import { sendAssignmentEmail, AssignmentEmailPayload } from './mailerService';

const prisma = new PrismaClient();

const NOTIFICATION_WINDOW_MINUTES = 15;
const CONCURRENCY_LIMIT = 5;

type BookingWithInclusions = Prisma.BookingGetPayload<{
    include: {
        origin: true;
        destination: true;
        driver: true;
    };
}>;

/**
 * Chiamato dal cron ogni minuto.
 * Cerca prenotazioni ASSIGNED con partenza nei prossimi 15 minuti
 * e driverNotified = false, poi invia la mail.
 */
export async function checkAndNotifyDrivers(): Promise<void> {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + NOTIFICATION_WINDOW_MINUTES * 60_000);

    console.log(`[NotificationService] Cron check at ${now.toISOString()}`);
    console.log(`[NotificationService] Looking for bookings between NOW and ${windowEnd.toISOString()}`);

    const upcomingBookings = await prisma.booking.findMany({
        where: {
            pickupAt: {
                gte: now,
                lte: windowEnd,
            },
            status: 'ASSIGNED',
            driverId: { not: null },
            driverNotified: false,
        },
        include: {
            origin: true,
            destination: true,
            driver: true,
        },
    }) as BookingWithInclusions[];

    if (upcomingBookings.length === 0) {
        console.log(`[NotificationService] No bookings to notify.`);
        return;
    }

    console.log(`[NotificationService] Found ${upcomingBookings.length} booking(s) to notify.`);
    upcomingBookings.forEach(b => {
        console.log(`[NotificationService] - Booking ${b.id}: pickupAt ${b.pickupAt.toISOString()}, driver ${b.driver?.email}`);
    });

    // Processa in batch per non sovraccaricare Mailjet
    for (let i = 0; i < upcomingBookings.length; i += CONCURRENCY_LIMIT) {
        const batch = upcomingBookings.slice(i, i + CONCURRENCY_LIMIT);
        await Promise.all(batch.map(booking => sendNotification(booking, true)));
    }
}

/**
 * Chiamato da bookings.ts quando si assegna un driver
 * a una corsa con partenza entro 15 minuti.
 * In questo caso la mail parte subito.
 */
export async function notifyDriverImmediately(bookingId: string): Promise<void> {
    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
            origin: true,
            destination: true,
            driver: true,
        },
    }) as BookingWithInclusions | null;

    if (!booking) {
        console.warn(`[NotificationService] Booking ${bookingId} not found.`);
        return;
    }

    if (!booking.driver?.email) {
        console.warn(`[NotificationService] Driver has no email for booking ${bookingId}.`);
        return;
    }

    await sendNotification(booking, false);
}

/**
 * Funzione interna che invia l'email e aggiorna driverNotified.
 * isReminder = true  → mail dal cron (promemoria 15 min prima)
 * isReminder = false → mail immediata su assegnazione con corsa imminente
 */
async function sendNotification(
    booking: BookingWithInclusions,
    isReminder: boolean
): Promise<void> {
    if (!booking.driver) {
        console.warn(`[NotificationService] No driver on booking ${booking.id}, skip.`);
        return;
    }

    try {
        const payload: AssignmentEmailPayload = {
            id: booking.id,
            pickupAt: booking.pickupAt,
            passengerName: booking.passengerName,
            passengerPhone: booking.passengerPhone,
            passengers: booking.passengers,
            notes: booking.notes,
            origin: booking.origin ?? { name: booking.originRaw ?? 'Non specificato' },
            destination: booking.destination ?? { name: booking.destinationRaw ?? 'Non specificato' },
            driver: booking.driver,
            isReminder,
        };

        // Questo lancerà un errore se la mail del driver manca o se SMTP non è configurato
        await sendAssignmentEmail(payload);

        // Segna sempre come notificato solo dopo invio riuscito.
        await prisma.booking.update({
            where: { id: booking.id },
            data: { driverNotified: true },
        });

        console.log(
            `[NotificationService] ✅ Email sent (${isReminder ? 'reminder/cron' : 'immediate'}) for booking ${booking.id} → ${booking.driver.email}`
        );
    } catch (err: any) {
        console.error(
            `[NotificationService] ❌ Failed to notify for booking ${booking.id}: ${err.message}`,
        );
        // Non rilanciamo: gli altri booking del batch non devono essere bloccati
    }
}

import { PrismaClient, Prisma } from '@prisma/client';
import { sendAssignmentEmail, AssignmentEmailPayload } from './mailerService';

const prisma = new PrismaClient();

const NOTIFICATION_WINDOW_MINUTES = 15;
const GRACE_PERIOD_MINUTES = 120;
const CONCURRENCY_LIMIT = 5;

// Define the type for a booking with the necessary inclusions
type BookingWithInclusions = Prisma.BookingGetPayload<{
    include: {
        origin: true;
        destination: true;
        driver: true;
    };
}>;

export async function checkAndNotifyDrivers(): Promise<void> {
    const now = new Date();
    const notificationDeadline = new Date(now.getTime() + NOTIFICATION_WINDOW_MINUTES * 60_000);
    const pastGracePeriod = new Date(now.getTime() - GRACE_PERIOD_MINUTES * 60_000);

    console.log(`[NotificationService] Running check at ${now.toISOString()}`);
    console.log(`[NotificationService] Window: ${pastGracePeriod.toISOString()} → ${notificationDeadline.toISOString()}`);

    const upcomingBookings = await prisma.booking.findMany({
        where: {
            pickupAt: {
                gte: pastGracePeriod,
                lte: notificationDeadline,
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
        console.log('[NotificationService] No bookings found in window.');
        return;
    }

    console.log(
        `[NotificationService] Found ${upcomingBookings.length} booking(s) to notify:`,
        upcomingBookings.map(b => `${b.id} (${b.passengerName}) at ${b.pickupAt.toISOString()}`)
    );

    // Process in batches to avoid overwhelming the mail service
    for (let i = 0; i < upcomingBookings.length; i += CONCURRENCY_LIMIT) {
        const batch = upcomingBookings.slice(i, i + CONCURRENCY_LIMIT);
        await Promise.all(batch.map(booking => notifyDriver(booking, true)));
    }
}

/**
 * Invia la notifica a un driver specifico per una determinata prenotazione.
 * Esportata per essere usata anche al momento dell'assegnazione manuale imminente.
 */
export async function notifyDriver(booking: BookingWithInclusions, isReminder: boolean = true): Promise<void> {
    if (!booking.driver?.email) {
        console.warn(`[NotificationService] SKIP: No driver or driver email for booking ${booking.id}`);
        return;
    }

    const { driver } = booking;

    try {
        console.log(`[NotificationService] Attempting to send ${isReminder ? 'reminder' : 'new assignment'} notification for booking ${booking.id} to ${driver.email}...`);

        const payload: AssignmentEmailPayload = {
            id: booking.id,
            pickupAt: booking.pickupAt,
            passengerName: booking.passengerName,
            passengerPhone: booking.passengerPhone,
            passengers: booking.passengers,
            notes: booking.notes,
            origin: booking.origin ?? { name: booking.originRaw ?? 'Non specificato' },
            destination: booking.destination ?? { name: booking.destinationRaw ?? 'Non specificato' },
            driver,
            isReminder,
        };

        // Atomically mark notified only after a confirmed send.
        // If sendAssignmentEmail throws, the flag stays false and we retry next cycle.
        await sendAssignmentEmail(payload);

        await prisma.booking.update({
            where: { id: booking.id },
            data: { driverNotified: true },
        });

        console.log(`[NotificationService] SUCCESS: Reminder sent for booking ${booking.id}`);
    } catch (err) {
        // Log and continue — other bookings must not be blocked by one failure
        console.error(`[NotificationService] FAILED notifying for booking ${booking.id}:`, err);
    }
}

/**
 * Helper per inviare la notifica caricando i dati dal database tramite ID.
 */
export async function notifyDriverByBookingId(bookingId: string): Promise<void> {
    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
            origin: true,
            destination: true,
            driver: true,
        },
    });

    if (!booking) {
        console.warn(`[NotificationService] Booking ${bookingId} not found.`);
        return;
    }

    await notifyDriver(booking as BookingWithInclusions);
}
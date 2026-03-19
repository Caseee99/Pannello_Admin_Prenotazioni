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

    // Target: corse tra 14:45 e 14:46 (se ora è 14:30)
    const targetStart = new Date(now.getTime() + NOTIFICATION_WINDOW_MINUTES * 60_000);
    const targetEnd = new Date(targetStart.getTime() + 60_000); // finestra di 1 minuto

    console.log(`[NotificationService] Running check at ${now.toISOString()}`);
    console.log(`[NotificationService] Target window: ${targetStart.toISOString()} → ${targetEnd.toISOString()}`);

    const upcomingBookings = await prisma.booking.findMany({
        where: {
            pickupAt: {
                gte: targetStart,
                lte: targetEnd,
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
    });
}

/**
 * Invia la notifica a un driver specifico per una determinata prenotazione.
 * Esportata per essere usata anche al momento dell'assegnazione manuale imminente.
 */
export async function notifyDriver(booking: BookingWithInclusions): Promise<void> {
    if (!booking.driver?.email) {
        console.warn(`[NotificationService] SKIP: No driver or driver email for booking ${booking.id}`);
        return;
    }

    const { driver } = booking;

    try {
        console.log(`[NotificationService] Attempting to send notification for booking ${booking.id} to ${driver.email}...`);

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
            isReminder: true,
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
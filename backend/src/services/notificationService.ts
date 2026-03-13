import { PrismaClient } from '@prisma/client';
import { sendAssignmentEmail } from './mailerService';

const prisma = new PrismaClient();

export async function checkAndNotifyDrivers() {
    console.log('[NotificationService] Checking for upcoming trips to notify drivers...');

    const now = new Date();
    const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60000);
    const sixteenMinutesFromNow = new Date(now.getTime() + 16 * 60000);

    // Find bookings that start in approximately 15 minutes and haven't notified the driver yet
    const upcomingBookings = await prisma.booking.findMany({
        where: {
            pickupAt: {
                gte: fifteenMinutesFromNow,
                lte: sixteenMinutesFromNow
            },
            status: 'ASSIGNED',
            driverId: { not: null },
            driverNotified: false
        },
        include: {
            origin: true,
            destination: true,
            driver: true
        }
    });

    console.log(`[NotificationService] Found ${upcomingBookings.length} bookings to notify.`);

    for (const booking of upcomingBookings) {
        if (booking.driver && booking.driver.email) {
            try {
                console.log(`[NotificationService] Sending reminder to driver ${booking.driver.name} for booking ${booking.id}`);
                
                await sendAssignmentEmail({
                    id: booking.id,
                    pickupAt: booking.pickupAt,
                    passengerName: booking.passengerName,
                    passengerPhone: booking.passengerPhone,
                    passengers: booking.passengers,
                    notes: booking.notes,
                    origin: booking.origin || { name: booking.originRaw || 'Non specificato' },
                    destination: booking.destination || { name: booking.destinationRaw || 'Non specificato' },
                    driver: booking.driver,
                    isReminder: true // We can update mailerService to handle this flag
                } as any);

                await prisma.booking.update({
                    where: { id: booking.id },
                    data: { driverNotified: true }
                });
                
                console.log(`[NotificationService] Reminder sent and flag updated for booking ${booking.id}`);
            } catch (err) {
                console.error(`[NotificationService] Error notifying driver for booking ${booking.id}:`, err);
            }
        }
    }
}

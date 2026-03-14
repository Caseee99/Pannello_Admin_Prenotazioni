import { PrismaClient } from '@prisma/client';
import { sendAssignmentEmail } from './mailerService';

const prisma = new PrismaClient();

export async function checkAndNotifyDrivers() {
    console.log('[NotificationService] Checking for upcoming trips to notify drivers...');

    const now = new Date();
    // Notifica se mancano 15 minuti O MENO (per gestire corse create/assegnate last-minute)
    // ma solo se la corsa non è già nel passato (grace period di 2 ore per sicurezza se il server era giù)
    const notificationDeadline = new Date(now.getTime() + 15 * 60000);
    const pastGracePeriod = new Date(now.getTime() - 120 * 60000); 

    console.log(`[NotificationService] [${now.toISOString()}] Running check...`);
    console.log(`[NotificationService] Window: ${pastGracePeriod.toISOString()} TO ${notificationDeadline.toISOString()}`);

    // Find bookings that start soon and haven't notified the driver yet
    const upcomingBookings = await prisma.booking.findMany({
        where: {
            pickupAt: {
                gte: pastGracePeriod,
                lte: notificationDeadline
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

    if (upcomingBookings.length > 0) {
        console.log(`[NotificationService] Found ${upcomingBookings.length} bookings to notify:`, 
            upcomingBookings.map(b => `${b.id} (${b.passengerName}) at ${b.pickupAt.toISOString()}`)
        );
    } else {
        // Logga ogni 10 minuti se non trova nulla per non intasare, o logga sempre se siamo in debug
        console.log(`[NotificationService] No bookings found in window.`);
    }

    for (const booking of upcomingBookings) {
        if (booking.driver && booking.driver.email) {
            try {
                console.log(`[NotificationService] Sending reminder for booking ${booking.id} to ${booking.driver.email}...`);
                
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
                    isReminder: true
                } as any);

                await prisma.booking.update({
                    where: { id: booking.id },
                    data: { driverNotified: true }
                });
                
                console.log(`[NotificationService] SUCCESS: Reminder sent and flag updated for ${booking.id}`);
            } catch (err) {
                console.error(`[NotificationService] FAILED notifying for ${booking.id}:`, err);
            }
        } else {
            console.warn(`[NotificationService] SKIP: No driver or driver email for booking ${booking.id}`);
        }
    }
}

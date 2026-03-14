import { PrismaClient } from '@prisma/client';
import { sendUnifiedAssignmentEmail } from './mailerService';

const prisma = new PrismaClient();

export async function checkAndNotifyDrivers() {
    console.log('[NotificationService] Checking for upcoming trips to notify drivers...');

    const now = new Date();
    const notificationDeadline = new Date(now.getTime() + 15 * 60000);
    const pastGracePeriod = new Date(now.getTime() - 120 * 60000); 

    console.log(`[NotificationService] [${now.toISOString()}] Running check...`);
    console.log(`[NotificationService] Window: ${pastGracePeriod.toISOString()} TO ${notificationDeadline.toISOString()}`);

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

    if (upcomingBookings.length === 0) {
        console.log(`[NotificationService] No bookings found in window.`);
        return;
    }

    console.log(`[NotificationService] Found ${upcomingBookings.length} bookings to notify.`);

    // Raggruppamento per driverId e orario di pickup
    const groups: Record<string, any[]> = {};

    upcomingBookings.forEach(b => {
        const key = `${b.driverId}_${b.pickupAt.getTime()}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(b);
    });

    for (const key of Object.keys(groups)) {
        const batch = groups[key];
        const driver = batch[0].driver;

        if (driver && driver.email) {
            try {
                console.log(`[NotificationService] Sending unified notification to ${driver.email} for ${batch.length} booking(s)...`);
                
                await sendUnifiedAssignmentEmail(driver, batch);

                // Aggiorna il flag per tutte le prenotazioni nel batch
                const ids = batch.map(b => b.id);
                await prisma.booking.updateMany({
                    where: { id: { in: ids } },
                    data: { driverNotified: true }
                });
                
                console.log(`[NotificationService] SUCCESS: Unified notification sent for IDs: ${ids.join(', ')}`);
            } catch (err) {
                console.error(`[NotificationService] FAILED unified notification for batch ${key}:`, err);
            }
        } else {
            console.warn(`[NotificationService] SKIP: No driver or driver email for batch ${key}`);
        }
    }
}

import cron from 'node-cron';
import { checkAndNotifyDrivers } from '../services/notificationService';

export function initCronJobs() {
    console.log('[CRON] Initializing background jobs...');

    // Esegui ogni minuto per le notifiche ai driver
    cron.schedule('* * * * *', async () => {
        try {
            await checkAndNotifyDrivers();
        } catch (error) {
            console.error('[CRON] Error in checkAndNotifyDrivers:', error);
        }
    });
}

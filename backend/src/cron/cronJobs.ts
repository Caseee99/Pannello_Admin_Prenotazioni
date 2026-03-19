import cron from 'node-cron';
import { checkAndNotifyDrivers } from '../services/notificationService';

export function initCronJobs() {
    console.log('[CRON] Initializing background jobs...');

    // Notifiche email ai driver (ogni minuto)
    cron.schedule('* * * * *', () => {
        checkAndNotifyDrivers().catch(err => {
            console.error('[CRON] Errore in checkAndNotifyDrivers:', err);
        });
    });
}

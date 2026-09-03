import cron, { ScheduledTask } from 'node-cron';
import { sendDailyMorningDigest } from './pushNotificationService';

let cronTask: ScheduledTask | null = null;

/**
 * Inizializza il job cron per la notifica del mattino (08:00 AM Europe/Rome)
 */
export function initCronJobs() {
  // Schedulazione: 08:00 AM ogni giorno ('0 8 * * *')
  // Nota: node-cron supporta l'opzione timezone
  cronTask = cron.schedule(
    '0 8 * * *',
    async () => {
      console.log('[CronService] ⏰ Esecuzione schedulata: Notifica del Mattino (08:00)');
      try {
        await sendDailyMorningDigest();
      } catch (err) {
        console.error('[CronService] ❌ Errore durante invio notifica del mattino schedulata:', err);
      }
    },
    {
      timezone: 'Europe/Rome',
    }
  );

  console.log('[CronService] ✅ Schedulatore notifiche del mattino attivato (Tutti i giorni alle 08:00 Europe/Rome)');
}

export function stopCronJobs() {
  if (cronTask) {
    cronTask.stop();
    console.log('[CronService] Schedulatore cron fermato.');
  }
}

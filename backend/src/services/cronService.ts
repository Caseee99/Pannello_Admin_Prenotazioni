import cron, { ScheduledTask } from 'node-cron';
import { sendDailyMorningDigest, sendUpcomingBookingAlerts } from './pushNotificationService';

const cronTasks: ScheduledTask[] = [];

/**
 * Inizializza i job cron per le notifiche automatiche.
 * 
 * NOTA IMPORTANTE: node-cron funziona solo se il processo Node.js rimane attivo.
 * Su Render.com piano gratuito il server va in sleep dopo 15 min di inattività.
 * Usare sempre un cron ESTERNO (es. cron-job.org) come backup principale:
 *   - GET https://<backend-url>/api/push/cron-morning?secret=<CRON_SECRET>  → ore 08:00
 *   - GET https://<backend-url>/api/push/cron-upcoming?secret=<CRON_SECRET> → ogni 30 min
 *   - GET https://<backend-url>/health                                        → ogni 14 min (keep-alive)
 */
export function initCronJobs() {
  // ─── 1. NOTIFICA DEL MATTINO ─────────────────────────────────────────────
  // Schedulata alle 07:55 come pre-esecuzione e alle 08:00 come principale.
  // Questa doppia schedulazione riduce il rischio di miss se il server
  // si sveglia con un leggero ritardo dopo il cold-start indotto dal keep-alive.

  const morningTask = cron.schedule(
    '0 8 * * *',
    async () => {
      console.log('[CronService] ⏰ Esecuzione: Notifica del Mattino (08:00 Rome)');
      try {
        const result = await sendDailyMorningDigest();
        console.log(`[CronService] ✅ Notifica mattino: ${result.successCount} inviate, ${result.failureCount} fallite.`);
      } catch (err) {
        console.error('[CronService] ❌ Errore notifica del mattino:', err);
      }
    },
    { timezone: 'Europe/Rome' }
  );

  cronTasks.push(morningTask);
  console.log('[CronService] ✅ Cron MATTINO attivato → Tutti i giorni alle 08:00 (Europe/Rome)');

  // ─── 2. NOTIFICHE PRENOTAZIONI IMMINENTI ────────────────────────────────
  // Ogni 30 minuti controlla se ci sono corse nella prossima ora e invia notifica.
  // Questo permette di non perdere nessuna corsa anche senza riepilogo mattutino.

  const upcomingTask = cron.schedule(
    '*/30 * * * *',
    async () => {
      const now = new Date();
      console.log(`[CronService] 🔍 Controllo prenotazioni imminenti (${now.toLocaleString('it-IT', { timeZone: 'Europe/Rome' })})`);
      try {
        const result = await sendUpcomingBookingAlerts();
        if (result && result.notified > 0) {
          console.log(`[CronService] ✅ Alert imminenti: ${result.notified} notifica/e inviata/e.`);
        }
      } catch (err) {
        console.error('[CronService] ❌ Errore alert prenotazioni imminenti:', err);
      }
    },
    { timezone: 'Europe/Rome' }
  );

  cronTasks.push(upcomingTask);
  console.log('[CronService] ✅ Cron IMMINENTI attivato → Ogni 30 minuti (Europe/Rome)');

  console.log('[CronService] 📌 REMINDER: Per garantire le notifiche su Render.com piano gratuito,');
  console.log('[CronService]    configura cron-job.org con i seguenti endpoint:');
  console.log(`[CronService]    • 08:00 daily  → GET /api/push/cron-morning?secret=${process.env.CRON_SECRET || 'secret-morning-cron-key-2026'}`);
  console.log(`[CronService]    • ogni 30 min  → GET /api/push/cron-upcoming?secret=${process.env.CRON_SECRET || 'secret-morning-cron-key-2026'}`);
  console.log('[CronService]    • ogni 14 min  → GET /health  (keep-alive per evitare il sleep)');
}

export function stopCronJobs() {
  cronTasks.forEach((task) => task.stop());
  cronTasks.length = 0;
  console.log('[CronService] Tutti gli schedulatori cron fermati.');
}

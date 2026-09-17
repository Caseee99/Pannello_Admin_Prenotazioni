import webpush from 'web-push';
import prisma from '../utils/prisma';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

const TIMEZONE = 'Europe/Rome';

// Inizializzazione chiavi VAPID da environment oppure fallback
let vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@cooperativataxi.it';

if (!vapidPublicKey || !vapidPrivateKey) {
  // Se non sono presenti in env, generiamo un set dinamico per lo sviluppo/test
  const generatedKeys = webpush.generateVAPIDKeys();
  vapidPublicKey = generatedKeys.publicKey;
  vapidPrivateKey = generatedKeys.privateKey;
  console.log('[PushService] ⚠️  Chiavi VAPID generate DINAMICAMENTE (non trovate nelle variabili d\'ambiente):');
  console.log(`[PushService] VAPID_PUBLIC_KEY="${vapidPublicKey}"`);
  console.log(`[PushService] VAPID_PRIVATE_KEY="${vapidPrivateKey}"`);
  console.log('[PushService] ‼️  ATTENZIONE: Imposta queste chiavi su Render.com → Environment Variables!');
  console.log('[PushService]    Le chiavi dinamiche cambiano ad ogni riavvio e invalidano le sottoscrizioni salvate nel DB.');
} else {
  const keyPreview = vapidPublicKey.slice(-10);
  console.log(`[PushService] ✅ Chiavi VAPID caricate da variabili d'ambiente (pubKey termina con: ...${keyPreview})`);
}

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

export function getVapidPublicKey(): string {
  return vapidPublicKey;
}

export interface SaveSubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
}

let isTableInitialized = false;

async function ensureTable() {
  if (isTableInitialized) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PushSubscription" (
        "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
        "endpoint" TEXT NOT NULL UNIQUE,
        "p256dh" TEXT NOT NULL,
        "auth" TEXT NOT NULL,
        "userAgent" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    isTableInitialized = true;
  } catch (err: any) {
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "PushSubscription" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "endpoint" TEXT NOT NULL UNIQUE,
          "p256dh" TEXT NOT NULL,
          "auth" TEXT NOT NULL,
          "userAgent" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      isTableInitialized = true;
    } catch (e: any) {
      console.warn('[PushService] Verifica tabella PushSubscription:', e.message);
    }
  }
}

/**
 * Salva o aggiorna una sottoscrizione push nel DB
 */
export async function saveSubscription(input: SaveSubscriptionInput) {
  await ensureTable();
  return prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: {
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent: input.userAgent,
    },
    update: {
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent: input.userAgent,
    },
  });
}

/**
 * Rimuove una sottoscrizione push dal DB
 */
export async function removeSubscription(endpoint: string) {
  await ensureTable();
  return prisma.pushSubscription.deleteMany({
    where: { endpoint },
  });
}

/**
 * Invia una notifica push a tutte le sottoscrizioni attive salvate nel DB
 */
export async function broadcastNotification(payload: { title: string; body: string; url?: string }) {
  await ensureTable();
  const subscriptions = await prisma.pushSubscription.findMany();

  if (subscriptions.length === 0) {
    console.log('[PushService] Nessuna sottoscrizione push trovata a cui inviare la notifica.');
    return { successCount: 0, failureCount: 0, warning: 'Nessun dispositivo registrato' };
  }

  console.log(`[PushService] 📡 Invio notifica a ${subscriptions.length} dispositivo/i...`);

  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    data: {
      url: payload.url || '/',
      timestamp: Date.now(),
    },
  });

  let successCount = 0;
  let failureCount = 0;
  const errors: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(pushSubscription, notificationPayload);
        successCount++;
        console.log(`[PushService] ✅ Inviata a dispositivo ${sub.id.slice(0, 8)}...`);
      } catch (err: any) {
        failureCount++;
        const errorMsg = `Status ${err.statusCode || 'N/A'}: ${err.message}`;
        errors.push(errorMsg);
        console.error(`[PushService] ❌ Fallita per ${sub.endpoint.slice(0, 50)}...: ${errorMsg}`);
        // Se la sottoscrizione è scaduta o non valida (404, 410 Gone), la rimuoviamo dal DB
        if (err.statusCode === 404 || err.statusCode === 410) {
          console.log(`[PushService] 🗑️  Rimuovo iscrizione non più valida: ${sub.id}`);
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }
    })
  );

  console.log(`[PushService] Broadcast completato: ${successCount} successi, ${failureCount} fallimenti.`);
  return { successCount, failureCount, errors };
}

/**
 * Genera e invia il riepilogo giornaliero delle corse (notifica mattutina delle 08:00)
 */
export async function sendDailyMorningDigest() {
  const now = new Date();

  const todayStr = formatInTimeZone(now, TIMEZONE, 'yyyy-MM-dd');
  const startOfDay = fromZonedTime(`${todayStr}T00:00:00`, TIMEZONE);
  const endOfDay = fromZonedTime(`${todayStr}T23:59:59.999`, TIMEZONE);

  const todayBookings = await prisma.booking.findMany({
    where: {
      pickupAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
      status: {
        not: 'CANCELLED',
      },
    },
    include: {
      origin: true,
      destination: true,
    },
    orderBy: {
      pickupAt: 'asc',
    },
  });

  const count = todayBookings.length;
  let title = '🚕 Riepilogo Corse di Oggi';
  let body = '';

  if (count === 0) {
    body = 'Buongiorno! Oggi non ci sono prenotazioni registrate.';
  } else {
    const firstBooking = todayBookings[0];
    let timeFormatted = '00:00';
    try {
      timeFormatted = formatInTimeZone(new Date(firstBooking.pickupAt), TIMEZONE, 'HH:mm');
    } catch {
      timeFormatted = String(firstBooking.pickupAt);
    }
    const originName = firstBooking.origin?.name || firstBooking.originRaw || 'Origine non spec.';
    const destName = firstBooking.destination?.name || firstBooking.destinationRaw || 'Destinazione non spec.';

    if (count === 1) {
      body = `Buongiorno! Oggi c'è 1 prenotazione. La corsa è alle ${timeFormatted} (${originName} ➔ ${destName}).`;
    } else {
      body = `Buongiorno! Oggi ci sono ${count} prenotazioni. La prima è alle ${timeFormatted} (${originName} ➔ ${destName}).`;
    }
  }

  console.log(`[PushService] 📬 Notifica Mattino: "${title}" — "${body}"`);
  return broadcastNotification({
    title,
    body,
    url: '/bookings?date=today',
  });
}

/**
 * Controlla se ci sono corse nella prossima ora e invia una notifica di promemoria.
 * Chiamata ogni 30 minuti dal cron interno o esterno (cron-job.org).
 *
 * Finestra di rilevamento: corse tra 50 e 70 minuti da adesso.
 * Questo evita notifiche duplicate quando il cron gira ogni 30 min:
 * ad esempio alle 09:00 rileva le corse tra 09:50 e 10:10,
 * alle 09:30 rileva le corse tra 10:20 e 10:40, senza sovrapposizioni.
 */
export async function sendUpcomingBookingAlerts() {
  const now = new Date();

  const from = new Date(now.getTime() + 50 * 60 * 1000);  // +50 min
  const to   = new Date(now.getTime() + 70 * 60 * 1000);  // +70 min

  const upcomingBookings = await prisma.booking.findMany({
    where: {
      pickupAt: { gte: from, lte: to },
      status: { not: 'CANCELLED' },
    },
    include: {
      origin: true,
      destination: true,
      driver: true,
    },
    orderBy: { pickupAt: 'asc' },
  });

  if (upcomingBookings.length === 0) {
    console.log(`[PushService] ⏭️  Nessuna corsa tra ${from.toISOString()} e ${to.toISOString()}.`);
    return { notified: 0 };
  }

  console.log(`[PushService] 🚨 ${upcomingBookings.length} corsa/e imminente/i → invio alert...`);

  let totalNotified = 0;

  for (const booking of upcomingBookings) {
    let timeFormatted = '??:??';
    try {
      timeFormatted = formatInTimeZone(new Date(booking.pickupAt), TIMEZONE, 'HH:mm');
    } catch {
      timeFormatted = String(booking.pickupAt);
    }

    const originName = booking.origin?.name || booking.originRaw || 'N/D';
    const destName   = booking.destination?.name || booking.destinationRaw || 'N/D';
    const driverName = booking.driver?.name || 'Nessun autista assegnato';
    const passenger  = booking.passengerName || 'Passeggero';

    const title = `⏰ Corsa tra ~1 ora — ${timeFormatted}`;
    const body  = `${passenger} · ${originName} ➔ ${destName} · Autista: ${driverName}`;

    const result = await broadcastNotification({
      title,
      body,
      url: `/bookings?id=${booking.id}`,
    });

    totalNotified += result.successCount;
  }

  return { notified: totalNotified };
}

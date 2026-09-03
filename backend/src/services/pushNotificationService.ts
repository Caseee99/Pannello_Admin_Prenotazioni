import webpush from 'web-push';
import prisma from '../utils/prisma';
import { formatInTimeZone } from 'date-fns-tz';

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
  console.log('[PushService] ⚠️ Chiavi VAPID generate dinamicamente:');
  console.log(`[PushService] VAPID_PUBLIC_KEY="${vapidPublicKey}"`);
  console.log(`[PushService] VAPID_PRIVATE_KEY="${vapidPrivateKey}"`);
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

/**
 * Salva o aggiorna una sottoscrizione push nel DB
 */
export async function saveSubscription(input: SaveSubscriptionInput) {
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
  return prisma.pushSubscription.deleteMany({
    where: { endpoint },
  });
}

/**
 * Invia una notifica a tutte le sottoscrizioni attive salvate
 */
export async function broadcastNotification(payload: { title: string; body: string; url?: string }) {
  const subscriptions = await prisma.pushSubscription.findMany();

  if (subscriptions.length === 0) {
    console.log('[PushService] Nessuna sottoscrizione push trovata a cui inviare la notifica.');
    return { successCount: 0, failureCount: 0 };
  }

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
      } catch (err: any) {
        failureCount++;
        console.error(`[PushService] Errore invio notifica a ${sub.endpoint}:`, err.statusCode || err.message);
        // Se la sottoscrizione è scaduta o non valida (404, 410 Gone), la rimuoviamo dal DB
        if (err.statusCode === 404 || err.statusCode === 410) {
          console.log(`[PushService] Rimuovo iscrizione non più valida: ${sub.id}`);
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }
    })
  );

  console.log(`[PushService] Broadcast completato: ${successCount} inviate con successo, ${failureCount} fallite.`);
  return { successCount, failureCount };
}

/**
 * Genera e invia il riepilogo giornaliero delle corse del mattino
 */
export async function sendDailyMorningDigest() {
  const now = new Date();

  // Inizio e fine della giornata in fuso orario locale
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

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
    const timeFormatted = formatInTimeZone(firstBooking.pickupAt, TIMEZONE, 'HH:mm');
    const originName = firstBooking.origin?.name || firstBooking.originRaw || 'Origine non spec.';
    const destName = firstBooking.destination?.name || firstBooking.destinationRaw || 'Destinazione non spec.';

    if (count === 1) {
      body = `Buongiorno! Oggi c'è 1 prenotazione. La corsa è alle ${timeFormatted} (${originName} ➔ ${destName}).`;
    } else {
      body = `Buongiorno! Oggi ci sono ${count} prenotazioni. La prima è alle ${timeFormatted} (${originName} ➔ ${destName}).`;
    }
  }

  console.log(`[PushService] Invio Notifica del Mattino: "${title}" - "${body}"`);
  return broadcastNotification({
    title,
    body,
    url: '/bookings?date=today',
  });
}

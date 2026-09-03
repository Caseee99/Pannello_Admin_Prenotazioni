import { FastifyInstance } from 'fastify';
import {
  getVapidPublicKey,
  saveSubscription,
  removeSubscription,
  broadcastNotification,
  sendDailyMorningDigest,
} from '../services/pushNotificationService';
import { z } from 'zod';

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

export async function pushRoutes(fastify: FastifyInstance) {
  // Ottieni la chiave pubblica VAPID per la sottoscrizione nel browser
  fastify.get('/vapid-public-key', async (_request, reply) => {
    return reply.send({ publicKey: getVapidPublicKey() });
  });

  // Salva sottoscrizione dispositivo
  fastify.post('/subscribe', async (request, reply) => {
    const parseResult = SubscribeSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Payload sottoscrizione non valido', details: parseResult.error.format() });
    }

    const userAgent = request.headers['user-agent'] as string | undefined;

    await saveSubscription({
      endpoint: parseResult.data.endpoint,
      keys: parseResult.data.keys,
      userAgent,
    });

    return reply.send({ success: true, message: 'Dispositivo iscritto con successo alle notifiche push.' });
  });

  // Rimuovi sottoscrizione dispositivo
  fastify.post('/unsubscribe', async (request, reply) => {
    const { endpoint } = request.body as { endpoint?: string };
    if (!endpoint) {
      return reply.status(400).send({ error: 'Endpoint mancante' });
    }

    await removeSubscription(endpoint);
    return reply.send({ success: true, message: 'Dispositivo rimosso dalle notifiche push.' });
  });

  // Invia notifica di prova immediata
  fastify.post('/test', async (_request, reply) => {
    const result = await broadcastNotification({
      title: '🔔 Test Notifica Push Admin',
      body: 'Le notifiche su questo dispositivo funzionano alla perfezione!',
      url: '/',
    });

    return reply.send({
      success: true,
      message: 'Notifica di prova inviata.',
      details: result,
    });
  });

  // Invia manualmente il riepilogo del mattino per test immediato
  fastify.post('/test-daily', async (_request, reply) => {
    const result = await sendDailyMorningDigest();
    return reply.send({
      success: true,
      message: 'Riepilogo del mattino eseguito manualmente per test.',
      details: result,
    });
  });
}

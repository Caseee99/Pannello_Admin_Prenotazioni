import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { notifyDriverImmediately } from '../services/notificationService';
import { sendAssignmentEmail } from '../services/mailerService';
import { generateExcel, generatePDF } from '../services/exportService';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const prisma = new PrismaClient();
const TIMEZONE = 'Europe/Rome';

export default async function bookingRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
    // Lista prenotazioni (con filtri base)
    fastify.get('/', async (request, reply) => {
        const { status, date, passengerName } = request.query as any;

        let where: any = {};
        const user = request.user as any;

        // Se è un'agenzia, vede solo le proprie prenotazioni (STRETTAMENTE per ID)
        if (user && user.role === 'agency') {
            where.agencyId = user.agencyId;
        }

        if (status) where.status = status;
        if (passengerName) {
            where.passengerName = {
                contains: passengerName,
                mode: 'insensitive'
            };
        }
        if (date) {
            // Calcolo inizio e fine giornata nel fuso orario di Roma
            // 'date' è atteso in formato YYYY-MM-DD
            const startDate = fromZonedTime(`${date}T00:00:00`, TIMEZONE);
            const endDate = fromZonedTime(`${date}T23:59:59.999`, TIMEZONE);
            
            where.pickupAt = { gte: startDate, lte: endDate };
        }

        let bookings = await prisma.booking.findMany({
            where,
            include: {
                origin: true,
                destination: true,
                driver: true,
            },
            orderBy: [
                { pickupAt: 'asc' },
                { id: 'asc' }
            ]
        });

        // Protezione della privacy per le agenzie: non mostriamo i dati sensibili del tassista
        if (user && user.role === 'agency') {
            bookings = bookings.map((b: any) => {
                if (b.driver) {
                    return {
                        ...b,
                        driver: {
                            id: b.driver.id,
                            name: 'Autista Assegnato',
                            licensePlate: b.driver.licensePlate,
                            phone: '***',
                            email: '***'
                        }
                    };
                }
                return b;
            });
        }

        return bookings;
    });

    // Esportazione Excel/PDF
    fastify.post('/export', async (request, reply) => {
        const { ids, format, status, date, passengerName } = request.body as any;
        const user = request.user as any;

        let where: any = {};
        if (user && user.role === 'agency') {
            where.agencyId = user.agencyId;
        }

        if (ids && Array.isArray(ids) && ids.length > 0) {
            where.id = { in: ids };
        } else {
            // Se non ci sono ID specifici, usiamo i filtri correnti
            if (status) where.status = status;
            if (passengerName) {
                where.passengerName = {
                    contains: passengerName,
                    mode: 'insensitive'
                };
            }
            if (date) {
                const startDate = fromZonedTime(`${date}T00:00:00`, TIMEZONE);
                const endDate = fromZonedTime(`${date}T23:59:59.999`, TIMEZONE);
                where.pickupAt = { gte: startDate, lte: endDate };
            }
        }

        const bookings = await prisma.booking.findMany({
            where,
            include: {
                origin: true,
                destination: true,
                driver: true,
            },
            orderBy: { pickupAt: 'asc' }
        });

        if (format === 'excel') {
            const buffer = generateExcel(bookings as any);
            reply
                .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
                .header('Content-Disposition', 'attachment; filename="prenotazioni.xlsx"')
                .send(buffer);
        } else if (format === 'pdf') {
            const buffer = await generatePDF(bookings as any);
            reply
                .header('Content-Type', 'application/pdf')
                .header('Content-Disposition', 'attachment; filename="prenotazioni.pdf"')
                .send(buffer);
        } else {
            return reply.code(400).send({ error: 'Formato non supportato. Usa "excel" o "pdf".' });
        }
    });

    // Creazione manuale prenotazione (da admin)
    fastify.post('/', async (request, reply) => {
        const {
            pickupAt,
            originId,
            destinationId,
            passengers,
            passengerName,
            passengerPhone,
            agency,
            agencyId: reqAgencyId,
            price,
            originRaw,
            destinationRaw,
            notes,
            driverId
        } = request.body as any;

        const user = request.user as any;

        // Se è un'agenzia, forziamo il collegamento alla propria agenzia
        let agencyName = agency;
        let agencyId: string | null = reqAgencyId || null;
        if (user && user.role === 'agency' && user.agencyId) {
            agencyId = user.agencyId;
            if (!agencyName) {
                agencyName = user.name || 'Agenzia';
            }
        }

        const booking = await prisma.booking.create({
            data: {
                pickupAt: fromZonedTime(pickupAt, TIMEZONE),
                originId: originId || null,
                destinationId: destinationId || null,
                passengers: Number(passengers),
                passengerName,
                passengerPhone,
                agency: agencyName,
                agencyId,
                price: price ? Number(price) : null,
                originRaw,
                destinationRaw,
                notes,
                driverId: driverId || null,
                status: driverId ? 'ASSIGNED' : 'CONFIRMED',
                source: 'Manual'
            }
        });

        // Gestione notifiche Driver al momento della creazione
        if (driverId && booking.status === 'ASSIGNED') {
            const now = new Date();
            const pickupTime = new Date(booking.pickupAt);
            const diffMinutes = (pickupTime.getTime() - now.getTime()) / 60_000;

            if (diffMinutes >= 0 && diffMinutes <= NOTIFICATION_WINDOW_MINUTES) {
                // Corsa imminente: invia mail subito
                console.log(`[Bookings POST] Corsa tra ${Math.round(diffMinutes)} min → notifica immediata`);
                notifyDriverImmediately(booking.id).catch(err => {
                    console.error('[Bookings POST] Errore notifyDriverImmediately:', err);
                });
            } else {
                // Corsa futura: il cron invierà la mail a -15 min
                console.log(`[Bookings POST] Corsa tra ${Math.round(diffMinutes)} min → il cron notificherà a -15 min`);
            }
        }

        return booking;
    });

    // Aggiorna prenotazione (es. cambia stato, assegna autista)
    fastify.patch('/:id', async (request, reply) => {
        const { id } = request.params as any;
        const {
            status,
            driverId,
            pickupAt,
            originId,
            originRaw,
            destinationId,
            destinationRaw,
            passengers,
            passengerName,
            passengerPhone,
            agency,
            agencyId,
            price,
            notes
        } = request.body as any;

        const data: any = {};
        if (status) data.status = status;

        // Traccia se il driver è cambiato per gestire il reset della notifica
        let driverChanged = false;
        if (driverId !== undefined) {
            data.driverId = driverId || null;
            if (driverId && !status) data.status = 'ASSIGNED';

            // Se cambia il driver, resetta driverNotified così il cron
            // invierà la mail al nuovo driver a -15 min
            data.driverNotified = false;
            driverChanged = true;
        }

        // Manual fields update
        if (pickupAt) {
            data.pickupAt = fromZonedTime(pickupAt, TIMEZONE);
            // Se cambia l'orario, resettiamo driverNotified così il cron 
            // può inviare una nuova mail se la corsa è ancora futura.
            data.driverNotified = false;
        }
        if (originId !== undefined) data.originId = originId || null;
        if (originRaw !== undefined) data.originRaw = originRaw;
        if (destinationId !== undefined) data.destinationId = destinationId || null;
        if (destinationRaw !== undefined) data.destinationRaw = destinationRaw;
        if (passengers !== undefined) data.passengers = Number(passengers);
        if (passengerName !== undefined) data.passengerName = passengerName;
        if (passengerPhone !== undefined) data.passengerPhone = passengerPhone;
        if (agency !== undefined) data.agency = agency;
        if (agencyId !== undefined) data.agencyId = agencyId || null;
        if (price !== undefined) data.price = price ? Number(price) : null;
        if (notes !== undefined) data.notes = notes;

        const user = request.user as any;

        // Se è un'agenzia, può modificare solo le proprie prenotazioni
        if (user && user.role === 'agency' && user.agencyId) {
            const existing = await prisma.booking.findUnique({
                where: { id },
                select: { agencyId: true },
            });

            if (!existing || existing.agencyId !== user.agencyId) {
                return reply.code(403).send({ error: 'Forbidden' });
            }

            // Ignora eventuali tentativi di cambiare autista o stato
            if ('driverId' in data) delete data.driverId;
            if ('status' in data) delete data.status;
            if ('driverNotified' in data) delete data.driverNotified;
        }

        const booking = await prisma.booking.update({
            where: { id },
            data,
            include: { origin: true, destination: true, driver: true }
        });

        // Gestione notifiche Driver su assegnazione/cambio driver
        if (driverChanged && driverId && booking.driver && booking.status === 'ASSIGNED') {
            const now = new Date();
            const pickupTime = new Date(booking.pickupAt);
            const diffMinutes = (pickupTime.getTime() - now.getTime()) / 60_000;

            if (diffMinutes >= 0 && diffMinutes <= NOTIFICATION_WINDOW_MINUTES) {
                // Corsa imminente: invia mail subito
                console.log(`[Bookings PATCH] Corsa tra ${Math.round(diffMinutes)} min → notifica immediata`);
                notifyDriverImmediately(booking.id).catch(err => {
                    console.error('[Bookings PATCH] Errore notifyDriverImmediately:', err);
                });
            } else {
                // Corsa futura: driverNotified è già false, il cron invierà a -15 min
                console.log(`[Bookings PATCH] Corsa tra ${Math.round(diffMinutes)} min → il cron notificherà a -15 min`);
            }
        }

        return booking;
    });

    // Elimina / Annulla
    fastify.delete('/:id', async (request, reply) => {
        const { id } = request.params as any;
        const user = request.user as any;

        if (user && user.role === 'agency' && user.agencyId) {
            const existing = await prisma.booking.findUnique({
                where: { id },
                select: { agencyId: true },
            });

            if (!existing || existing.agencyId !== user.agencyId) {
                return reply.code(403).send({ error: 'Forbidden' });
            }
        }

        await prisma.booking.update({
            where: { id },
            data: { status: 'CANCELLED' }
        });
        return { success: true };
    });

    // Reinvia notifica email al driver (Manuale)
    fastify.post('/:id/resend-notification', async (request, reply) => {
        const { id } = request.params as any;
        const user = request.user as any;

        // Solo admin può reinviare notifiche
        if (user && user.role === 'agency') {
            return reply.code(403).send({ error: 'Solo l\'amministratore può reinviare le notifiche.' });
        }

        try {
            await notifyDriverImmediately(id);
            return { success: true, message: 'Notifica inviata con successo.' };
        } catch (err: any) {
            return reply.code(500).send({ error: 'Errore nell\'invio della notifica', message: err.message });
        }
    });

    // Diagnostic route to check SMTP configuration (WITHOUT exposing full passwords)
    fastify.get('/smtp-check', async (request, reply) => {
        const user = request.user as any;
        if (user.role !== 'admin') return reply.code(403).send({ error: 'Accesso negato' });

        const smtp_user = process.env.EMAIL_SMTP_USER || process.env.SMTP_USER;
        const smtp_pass = process.env.EMAIL_SMTP_PASS || process.env.SMTP_PASS;
        const smtp_host = process.env.EMAIL_SMTP_HOST || process.env.SMTP_HOST;
        const smtp_from = process.env.EMAIL_SMTP_FROM || process.env.SMTP_FROM;

        return {
            configured: !!(smtp_user && smtp_pass),
            host: smtp_host || 'default-mailjet',
            from: smtp_from || 'MISSING',
            userPrefix: smtp_user ? smtp_user.substring(0, 5) + '...' : 'MISSING',
            passPrefix: smtp_pass ? '********' : 'MISSING',
            envKeysFound: Object.keys(process.env).filter(k => k.includes('SMTP')),
            serverTime: new Date().toISOString()
        };
    });

    // Invia email di test (solo Admin)
    fastify.post('/test-email', async (request, reply) => {
        const user = request.user as any;
        if (user.role !== 'admin') return reply.code(403).send({ error: 'Accesso negato' });

        const { to } = request.body as any;
        if (!to) return reply.code(400).send({ error: 'Mail destinatario mancante' });

        try {
            // Creiamo una prenotazione fittizia o usiamo una funzione di test diretta
            await sendAssignmentEmail({
                id: 'TEST-ID',
                pickupAt: new Date(),
                passengerName: 'Test Utente',
                passengerPhone: '123456789',
                passengers: 2,
                notes: 'Email di test configurazione SMTP',
                origin: { name: 'Punto Partenza Test' },
                destination: { name: 'Punto Arrivo Test' },
                driver: {
                    name: 'Admin Test',
                    email: to,
                    phone: '000000000'
                },
                isReminder: false
            });
            return { success: true, message: `Email di test inviata a ${to}` };
        } catch (err: any) {
            return reply.code(500).send({ error: 'Errore durante l\'invio del test', message: err.message });
        }
    });
}

// Costante locale per chiarezza nel codice
const NOTIFICATION_WINDOW_MINUTES = 15;

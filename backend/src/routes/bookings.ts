import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { notifyDriverImmediately } from '../services/notificationService';

const prisma = new PrismaClient();

export default async function bookingRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
    // Lista prenotazioni (con filtri base)
    fastify.get('/', async (request, reply) => {
        const { status, date } = request.query as any;

        let where: any = {};
        const user = request.user as any;

        // Se è un'agenzia, vede solo le proprie prenotazioni (STRETTAMENTE per ID)
        if (user && user.role === 'agency') {
            where.agencyId = user.agencyId;
        }

        if (status) where.status = status;
        if (date) {
            const startDate = new Date(date);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);
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
                pickupAt: new Date(pickupAt),
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
        if (pickupAt) data.pickupAt = new Date(pickupAt);
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
}

// Costante locale per chiarezza nel codice
const NOTIFICATION_WINDOW_MINUTES = 15;

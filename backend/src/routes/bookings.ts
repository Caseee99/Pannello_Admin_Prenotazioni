import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { sendAssignmentEmail } from '../services/mailerService';
import { notifyDriver } from '../services/notificationService';

const prisma = new PrismaClient();
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
                            licensePlate: b.driver.licensePlate, // Targa utile per il cliente
                            // Oscuriamo telefono ed email
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
        let agencyId: string | null = (reqAgencyId && UUID_REGEX.test(reqAgencyId)) ? reqAgencyId : null;
        if (user && user.role === 'agency' && user.agencyId) {
            agencyId = user.agencyId;
            if (!agencyName) {
                agencyName = user.name || 'Agenzia';
            }
        }

        const booking = await prisma.booking.create({
            data: {
                pickupAt: new Date(pickupAt),
                originId: (originId && UUID_REGEX.test(originId)) ? originId : null,
                destinationId: (destinationId && UUID_REGEX.test(destinationId)) ? destinationId : null,
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
                // Se c'è un driver, mettiamo subito ASSIGNED, altrimenti CONFIRMED (da assegnare)
                status: driverId ? 'ASSIGNED' : 'CONFIRMED',
                source: 'Manual'
            }
        });

        // Gestione notifiche Driver (Immediata se imminente)
        if (driverId && booking.status === 'ASSIGNED') {
            try {
                const now = new Date();
                const pickupTime = new Date(booking.pickupAt);
                const diffMinutes = (pickupTime.getTime() - now.getTime()) / 60_000;

                if (diffMinutes <= 15) {
                    // Carichiamo i dettagli per la notifica
                    const fullBooking = await prisma.booking.findUnique({
                        where: { id: booking.id },
                        include: { origin: true, destination: true, driver: true }
                    });
                    if (fullBooking && fullBooking.driver) {
                        console.log(`[Bookings] Corsa imminente in creazione, invio email immediata.`);
                        notifyDriver(fullBooking as any, false).catch(err => {
                            console.error('[Bookings] Errore async notifyDriver (POST):', err);
                        });
                    }
                }
            } catch (notifyErr) {
                console.error('[Bookings] Errore blocco notifica (POST):', notifyErr);
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
        if (driverId !== undefined) {
            data.driverId = driverId || null;
            data.driverNotified = false; // Forza il reset della notifica se cambia l'autista
            if (driverId && !status) data.status = 'ASSIGNED';
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
        if (agencyId !== undefined) {
            data.agencyId = (agencyId && UUID_REGEX.test(agencyId)) ? agencyId : null;
        }
        if (originId !== undefined) {
            data.originId = (originId && UUID_REGEX.test(originId)) ? originId : null;
        }
        if (destinationId !== undefined) {
            data.destinationId = (destinationId && UUID_REGEX.test(destinationId)) ? destinationId : null;
        }

        // Autocomplete agency name if agencyId is provided but name is dummy or ID-like
        if (data.agencyId && (!data.agency || data.agency.length > 30)) {
            const agencyObj = await prisma.agency.findUnique({ where: { id: data.agencyId } });
            if (agencyObj) data.agency = agencyObj.name;
        }
        if (price !== undefined) data.price = price ? Number(price) : null;
        if (notes !== undefined) data.notes = notes;

        const user = request.user as any;

        // Se è un'agenzia, può modificare solo le proprie prenotazioni
        // e NON può cambiare autista o stato
        if (user && user.role === 'agency' && user.agencyId) {
            const existing = await prisma.booking.findUnique({
                where: { id },
                select: { agencyId: true },
            });

            if (!existing || existing.agencyId !== user.agencyId) {
                return reply.code(403).send({ error: 'Forbidden' });
            }

            // Ignora eventuali tentativi di cambiare autista o stato
            if ('driverId' in data) {
                delete data.driverId;
            }
            if ('status' in data) {
                delete data.status;
            }
        }

        const booking = await prisma.booking.update({
            where: { id },
            data,
            include: { origin: true, destination: true, driver: true }
        });

        // Gestione notifiche Driver
        if (driverId && booking.driver && booking.status === 'ASSIGNED') {
            try {
                // Verifichiamo se la corsa è imminente (entro 15 minuti)
                const now = new Date();
                const pickupTime = new Date(booking.pickupAt);
                const diffMinutes = (pickupTime.getTime() - now.getTime()) / 60_000;

                if (diffMinutes <= 15) {
                    console.log(`[Bookings] Corsa imminente in modifica (${Math.round(diffMinutes)} min), invio email immediata.`);
                    notifyDriver(booking as any, false).catch(err => {
                        console.error('[Bookings] Errore async notifyDriver (PATCH):', err);
                    });
                } else {
                    console.log(`[Bookings] Corsa programmata tra ${Math.round(diffMinutes)} min, la notifica verrà gestita dal cron.`);
                }
            } catch (notifyErr) {
                console.error('[Bookings] Errore blocco notifica (PATCH):', notifyErr);
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

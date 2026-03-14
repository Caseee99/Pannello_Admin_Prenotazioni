import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { sendAssignmentEmail } from '../services/mailerService';

const prisma = new PrismaClient();

export default async function bookingRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
    // Lista prenotazioni (con filtri base)
    fastify.get('/', async (request, reply) => {
        const { status, date } = request.query as any;

        let where: any = {};
        const user = request.user as any;

        // Se è un'agenzia, vede solo le proprie prenotazioni
        if (user && user.role === 'agency' && user.agencyId) {
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

        const bookings = await prisma.booking.findMany({
            where,
            include: {
                origin: true,
                destination: true,
                driver: true,
            },
            orderBy: { pickupAt: 'asc' }
        });
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
            price, 
            originRaw, 
            destinationRaw, 
            notes 
        } = request.body as any;

        const user = request.user as any;

        // Se è un'agenzia, forziamo il collegamento alla propria agenzia
        let agencyName = agency;
        let agencyId: string | undefined = undefined;
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
                // Per ora usiamo CONFIRMED come "Da assegnare"
                status: 'CONFIRMED',
                source: 'Manual'
            }
        });

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
            price,
            notes
        } = request.body as any;

        const data: any = {};
        if (status) data.status = status;
        if (driverId !== undefined) {
            data.driverId = driverId || null;
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

        // Invia email al tassista appena assegnato (DISATTIVATO: ora solo 15 min prima via NotificationService)
        /*
        if (driverId && booking.driver && booking.status === 'ASSIGNED') {
            try {
                await sendAssignmentEmail({
                    ...
                });
            } catch (emailErr) {
                console.error('[Bookings] Errore invio email assegnazione:', emailErr);
            }
        }
        */

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

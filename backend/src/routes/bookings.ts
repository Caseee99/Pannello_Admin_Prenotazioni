import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function bookingRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
    // Lista prenotazioni (con filtri base)
    fastify.get('/', async (request, reply) => {
        const { status, date } = request.query as any;

        let where: any = {};
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
        const { pickupAt, originId, destinationId, passengers, passengerName, passengerPhone, notes } = request.body as any;

        const booking = await prisma.booking.create({
            data: {
                pickupAt: new Date(pickupAt),
                originId,
                destinationId,
                passengers: Number(passengers),
                passengerName,
                passengerPhone,
                notes,
                status: 'CONFIRMED', // Creata manualmente va subito in confirmed
                source: 'Manual'
            }
        });

        return booking;
    });

    // Aggiorna prenotazione (es. cambia stato, assegna autista)
    fastify.patch('/:id', async (request, reply) => {
        const { id } = request.params as any;
        const { status, driverId } = request.body as any;

        const data: any = {};
        if (status) data.status = status;
        if (driverId !== undefined) {
            data.driverId = driverId;
            if (driverId && !status) data.status = 'ASSIGNED';
        }

        const booking = await prisma.booking.update({
            where: { id },
            data,
            include: { origin: true, destination: true, driver: true }
        });

        // Se completata, dovremmo creare il pagamento in T7
        if (status === 'COMPLETED' && booking.driverId) {
            // Logica del pagamento mock (sarà affinata dopo)
        }

        return booking;
    });

    // Elimina / Annulla
    fastify.delete('/:id', async (request, reply) => {
        const { id } = request.params as any;
        await prisma.booking.update({
            where: { id },
            data: { status: 'CANCELLED' }
        });
        return { success: true };
    });
}

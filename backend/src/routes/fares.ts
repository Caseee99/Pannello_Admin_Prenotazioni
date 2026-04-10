import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import prisma from '../utils/prisma';




export default async function fareRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
    // Lista tariffe con origin e destination
    fastify.get('/', async (request, reply) => {
        const fares = await prisma.fare.findMany({
            where: { active: true },
            include: {
                origin: true,
                destination: true
            }
        });
        return fares;
    });

    // Aggiungi o aggiorna tariffa
    fastify.post('/', async (request, reply) => {
        const { originId, destinationId, amount } = request.body as any;

        // Upsert fare
        const fare = await prisma.fare.upsert({
            where: {
                originId_destinationId: {
                    originId,
                    destinationId
                }
            },
            update: { amount },
            create: { originId, destinationId, amount }
        });
        return fare;
    });
}

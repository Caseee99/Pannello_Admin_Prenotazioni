import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import prisma from '../utils/prisma';




export default async function locationRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
    // Lista locations attive
    fastify.get('/', async (request, reply) => {
        const locations = await prisma.location.findMany({
            where: { active: true },
            orderBy: { name: 'asc' }
        });
        return locations;
    });

    // Aggiungi location
    fastify.post('/', async (request, reply) => {
        const { name, type } = request.body as any;
        const location = await prisma.location.create({
            data: { name, type }
        });
        return location;
    });
}

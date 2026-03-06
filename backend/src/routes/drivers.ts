import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function driverRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
    // Lista autisti con availabilities
    fastify.get('/', async (request, reply) => {
        const drivers = await prisma.driver.findMany({
            where: { active: true },
            include: {
                availabilities: {
                    orderBy: { weekStart: 'desc' },
                    take: 1
                }
            },
            orderBy: { name: 'asc' }
        });
        return drivers;
    });

    // Crea autista
    fastify.post('/', async (request, reply) => {
        const { name, phone, email } = request.body as any;
        const driver = await prisma.driver.create({
            data: { name, phone, email }
        });
        return driver;
    });
}

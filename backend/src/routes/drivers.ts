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

    // Creazione autista
    fastify.post('/', async (request, reply) => {
        const { name, phone, email, licensePlate, seats } = request.body as any;
        const driver = await prisma.driver.create({
            data: { name, phone, email, licensePlate, seats: seats ? Number(seats) : 4 }
        });
        return driver;
    });

    // Aggiorna autista (es: attivazione/disattivazione o modifica anagrafica)
    fastify.patch('/:id', async (request, reply) => {
        const { id } = request.params as any;
        const { active, name, phone, email, licensePlate, seats } = request.body as any;
        
        const data: any = {};
        if (active !== undefined) data.active = active;
        if (name !== undefined) data.name = name;
        if (phone !== undefined) data.phone = phone;
        if (email !== undefined) data.email = email;
        if (licensePlate !== undefined) data.licensePlate = licensePlate;
        if (seats !== undefined) data.seats = Number(seats);

        const driver = await prisma.driver.update({
            where: { id },
            data
        });
        return driver;
    });

    // Modifica disponibilità
    fastify.patch('/:id/availability', async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as any;
        const driverId = id;

        // find if availability exists for driver
        const exist = await prisma.availability.findFirst({
            where: { driverId }
        });

        if (exist) {
            return await prisma.availability.update({
                where: { id: exist.id },
                data: {
                    mon: body.mon, tue: body.tue, wed: body.wed,
                    thu: body.thu, fri: body.fri, sat: body.sat, sun: body.sun
                }
            });
        } else {
            return await prisma.availability.create({
                data: {
                    driverId,
                    mon: body.mon, tue: body.tue, wed: body.wed,
                    thu: body.thu, fri: body.fri, sat: body.sat, sun: body.sun,
                    weekStart: new Date()
                }
            });
        }
    });
}

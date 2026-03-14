import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export default async function agencyRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
    // Lista agenzie (solo admin)
    fastify.get('/', async (request, reply) => {
        const user = request.user as any;
        if (!user || user.role !== 'admin') {
            return reply.code(403).send({ error: 'Forbidden' });
        }

        const agencies = await prisma.agency.findMany({
            orderBy: { name: 'asc' },
        });
        return agencies;
    });

    // Crea nuova agenzia + credenziali accesso (solo admin)
    fastify.post('/', async (request, reply) => {
        const user = request.user as any;
        if (!user || user.role !== 'admin') {
            return reply.code(403).send({ error: 'Forbidden' });
        }

        const { name, email, loginEmail, password } = request.body as any;

        if (!name || !loginEmail || !password) {
            return reply.code(400).send({ error: 'Dati mancanti' });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const agency = await prisma.agency.create({
            data: {
                name,
                email: email || null,
                loginEmail: loginEmail.toLowerCase().trim(),
                passwordHash,
            },
        });

        return agency;
    });

    // Aggiorna stato agenzia (attiva/non attiva) o reset password (solo admin)
    fastify.patch('/:id', async (request, reply) => {
        const user = request.user as any;
        if (!user || user.role !== 'admin') {
            return reply.code(403).send({ error: 'Forbidden' });
        }

        const { id } = request.params as any;
        const { name, email, active, password } = request.body as any;

        const data: any = {};
        if (name !== undefined) data.name = name;
        if (email !== undefined) data.email = email;
        if (active !== undefined) data.active = active;
        if (password) {
            data.passwordHash = await bcrypt.hash(password, 10);
        }

        const agency = await prisma.agency.update({
            where: { id },
            data,
        });

        return agency;
    });
}


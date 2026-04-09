import prisma from '../utils/prisma';
import bcrypt from 'bcryptjs';


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

    // Aggancia le prenotazioni esistenti basate sul nome agenzia (es. GoGo Viaggi) all'Agency appena creata
    fastify.post('/:id/backfill-bookings', async (request, reply) => {
        const user = request.user as any;
        if (!user || user.role !== 'admin') {
            return reply.code(403).send({ error: 'Forbidden' });
        }

        const { id } = request.params as any;

        const agency = await prisma.agency.findUnique({
            where: { id },
        });

        if (!agency) {
            return reply.code(404).send({ error: 'Agency not found' });
        }

        // Collega tutte le prenotazioni che hanno il campo "agency" uguale al nome e non hanno ancora agencyId
        const result = await prisma.booking.updateMany({
            where: {
                agencyId: null,
                agency: agency.name,
            },
            data: {
                agencyId: agency.id,
            },
        });

        return { updated: result.count };
    });
}


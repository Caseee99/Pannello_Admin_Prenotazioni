import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const loginSchema = z.object({
    username: z.string(),
    password: z.string(),
});

export default async function authRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
    fastify.post('/login', async (request, reply) => {
        try {
            const { username, password } = loginSchema.parse(request.body);

            const providedUsername = username.toLowerCase().trim();

            // 1) Tentativo login ADMIN (come prima)
            const adminEmail = (process.env.EMAIL_IMAP_USER || process.env.EMAIL_USER || 'gaetanocasella00@gmail.com').toLowerCase();
            const adminPassword = 'Forzanapoli2026@';

            if ((providedUsername === adminEmail || providedUsername === 'admin') && password === adminPassword) {
                const token = fastify.jwt.sign({ role: 'admin', email: adminEmail });
                return { token };
            }

            // 2) Tentativo login AGENZIA
            const agency = await prisma.agency.findFirst({
                where: {
                    loginEmail: providedUsername,
                },
            });

            if (agency) {
                if (!agency.active) {
                    return reply.code(403).send({ error: 'Account disattivato' });
                }
                const ok = await bcrypt.compare(password, agency.passwordHash);
                if (ok) {
                    const token = fastify.jwt.sign({
                        role: 'agency',
                        agencyId: agency.id,
                        email: agency.loginEmail,
                        name: agency.name,
                    });
                    return { token };
                }
            }

            reply.code(401).send({ error: 'Credenziali non valide' });
        } catch (e) {
            reply.code(400).send({ error: 'Input non valido' });
        }
    });

    fastify.get('/me', {
        preValidation: [async (request, reply) => {
            try {
                await request.jwtVerify();
            } catch (err) {
                reply.send(err);
            }
        }]
    }, async (request, reply) => {
        return { user: request.user };
    });
}

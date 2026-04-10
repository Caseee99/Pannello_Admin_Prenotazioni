import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import prisma from '../utils/prisma';

import { z } from 'zod';
import bcrypt from 'bcryptjs';



const loginSchema = z.object({
    username: z.string(),
    password: z.string(),
});

export default async function authRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
    fastify.post('/login', {
        config: {
            rateLimit: {
                max: 10,
                timeWindow: '1 minute',
                errorResponseBuilder: () => ({
                    statusCode: 429,
                    error: 'Troppi tentativi di accesso. Riprova tra un minuto.'
                })
            }
        }
    }, async (request, reply) => {
        try {
            const { username, password } = loginSchema.parse(request.body);

            const providedUsername = username.toLowerCase().trim();

            // 1) Tentativo login ADMIN (solo se le variabili sono configurate)
            const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
            const adminPassword = process.env.ADMIN_PASSWORD || '';

            if (adminEmail && adminPassword) {
                if ((providedUsername === adminEmail || providedUsername === 'admin') && password === adminPassword) {
                    const token = fastify.jwt.sign(
                        { role: 'admin', email: adminEmail },
                        { expiresIn: '8h' }
                    );
                    return { token };
                }
            } else {
                console.warn('[AUTH] ADMIN_EMAIL o ADMIN_PASSWORD non configurati. Login admin disabilitato.');
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
                    const token = fastify.jwt.sign(
                        {
                            role: 'agency',
                            agencyId: agency.id,
                            email: agency.loginEmail,
                            name: agency.name,
                        },
                        { expiresIn: '12h' }
                    );
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

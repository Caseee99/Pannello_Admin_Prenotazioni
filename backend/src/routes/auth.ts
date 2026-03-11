import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';

const loginSchema = z.object({
    username: z.string(),
    password: z.string(),
});

export default async function authRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
    fastify.post('/login', async (request, reply) => {
        try {
            const { username, password } = loginSchema.parse(request.body);

            // Credenziali Admin - Cerchiamo in diverse variabili per sicurezza
            const adminEmail = (process.env.EMAIL_IMAP_USER || process.env.EMAIL_USER || 'gaetanocasella00@gmail.com').toLowerCase();
            const adminPassword = 'Forzanapoli2026@';

            const providedUsername = username.toLowerCase().trim();

            // Permetti l'uso di 'admin', dell'email IMAP o dell'email admin
            if ((providedUsername === adminEmail || providedUsername === 'admin') && password === adminPassword) {
                const token = fastify.jwt.sign({ role: 'admin', email: adminEmail });
                return { token };
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

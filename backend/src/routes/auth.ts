import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';

const loginSchema = z.object({
    email: z.string(),
    password: z.string(),
});

export default async function authRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
    fastify.post('/login', async (request, reply) => {
        try {
            const { email, password } = loginSchema.parse(request.body);

            // Credenziali Admin
            const adminEmail = process.env.EMAIL_IMAP_USER || 'admin@admin.com';
            const adminPassword = 'Forzanapoli2026@';

            // Permetti l'uso di 'admin' come username o l'email reale
            if ((email === adminEmail || email === 'admin') && password === adminPassword) {
                const token = fastify.jwt.sign({ role: 'admin', email });
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

import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

export default async function authRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
    fastify.post('/login', async (request, reply) => {
        try {
            const { email, password } = loginSchema.parse(request.body);

            // Semplice auth hardcodata per 1 solo admin (come da specifiche, niente multi-utente)
            const adminEmail = process.env.EMAIL_USER || 'admin@admin.com';
            const adminPassword = 'admin'; // IN PRODUZIONE DEVE ESSERE BCRYPT HASHATA

            if (email === adminEmail && password === adminPassword) {
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

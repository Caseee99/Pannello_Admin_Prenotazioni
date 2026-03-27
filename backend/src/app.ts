import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import authRoutes from './routes/auth';
import locationRoutes from './routes/locations';
import driverRoutes from './routes/drivers';
import fareRoutes from './routes/fares';
import bookingRoutes from './routes/bookings';
import reportRoutes from './routes/reports';
import agencyRoutes from './routes/agencies';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import "dotenv/config";
import rateLimit from '@fastify/rate-limit';

const prisma = new PrismaClient();

const buildServer = async (): Promise<FastifyInstance> => {
    const server = Fastify({
        logger: true,
    });

    const allowedOrigins = [
        process.env.FRONTEND_URL || '',
        process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : '',
    ].filter(Boolean);

    await server.register(cors, {
        origin: (origin, cb) => {
            if (!origin || allowedOrigins.includes(origin)) {
                cb(null, true);
            } else {
                cb(new Error('Not allowed by CORS'), false);
            }
        },
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        credentials: true,
    });

    await server.register(jwt, {
        secret: process.env.JWT_SECRET || 'super-secret',
    });



    await server.register(rateLimit, {
        global: false
    });

    // Health check
    server.get('/health', async (request, reply) => {
        return { status: 'OK', message: 'Backend is running', version: '1.0.1-' + new Date().toISOString() };
    });



    // Public Routes
    server.register(authRoutes, { prefix: '/api/auth' });

    // Applica JWT middleware per le route protette
    server.register(async (protectedRoutes) => {
        protectedRoutes.addHook('preValidation', async (request, reply) => {
            try {
                await request.jwtVerify();

                // Extra security check for agencies: verify if still active
                const user = request.user as any;
                if (user && user.role === 'agency' && user.agencyId) {
                    const agency = await prisma.agency.findUnique({
                        where: { id: user.agencyId },
                        select: { active: true }
                    });
                    if (!agency || !agency.active) {
                        return reply.code(403).send({ error: 'Account disattivato' });
                    }
                }
            } catch (err: any) {
                server.log.error(err, '[AUTH ERROR]');
                return reply.code(401).send({ error: 'Unauthorized', message: err.message });
            }
        });

        // Debug & Diagnostics (ADMIN ONLY)
        protectedRoutes.get('/db-test', async (request, reply) => {
            const user = request.user as any;
            if (!user || user.role !== 'admin') {
                return reply.code(403).send({ error: 'Forbidden: solo gli admin possono accedere' });
            }
            try {
                const count = await prisma.booking.count();
                return { status: 'OK', count, message: 'Database connection successful' };
            } catch (err: any) {
                server.log.error(err, '[DB TEST ERROR]');
                return reply.code(500).send({ status: 'ERROR', error: err.message, stack: err.stack });
            }
        });

        protectedRoutes.get('/db-debug', async (request, reply) => {
            const user = request.user as any;
            if (!user || user.role !== 'admin') {
                return reply.code(403).send({ error: 'Forbidden: solo gli admin possono accedere' });
            }
            try {
                const now = new Date();
                const bookings = await prisma.booking.findMany({
                    where: {
                        pickupAt: {
                            gte: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Ultime 24h
                            lte: new Date(now.getTime() + 24 * 60 * 60 * 1000)  // Prossime 24h
                        }
                    },
                    orderBy: { pickupAt: 'asc' },
                    include: { driver: true }
                });
                return {
                    status: 'OK',
                    serverTime: now.toISOString(),
                    localTimeEstimate: now.toLocaleString('it-IT', { timeZone: 'Europe/Rome' }),
                    count: bookings.length,
                    bookings: bookings.map(b => ({
                        id: b.id,
                        pickupAt: b.pickupAt,
                        status: b.status,
                        driver: b.driver?.name
                    }))
                };
            } catch (err: any) {
                return reply.code(500).send({ error: err.message });
            }
        });

        protectedRoutes.get('/diagnostics', async (request, reply) => {
            const user = request.user as any;
            if (!user || user.role !== 'admin') {
                return reply.code(403).send({ error: 'Forbidden: solo gli admin possono accedere' });
            }
            return reply.send({
                status: 'OK',
                env: {
                    NODE_ENV: process.env.NODE_ENV
                },
                time: {
                    utc: new Date().toISOString(),
                    localEstimate: new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' })
                }
            });
        });

        protectedRoutes.register(locationRoutes, { prefix: '/api/locations' });
        protectedRoutes.register(driverRoutes, { prefix: '/api/drivers' });
        protectedRoutes.register(fareRoutes, { prefix: '/api/fares' });
        protectedRoutes.register(bookingRoutes, { prefix: '/api/bookings' });
        protectedRoutes.register(reportRoutes, { prefix: '/api/reports' });
        protectedRoutes.register(agencyRoutes, { prefix: '/api/agencies' });
    });

    server.setErrorHandler((error, request, reply) => {
        server.log.error(error, '[GLOBAL ERROR]');
        reply.status(500).send({ error: 'Internal Server Error', message: error.message });
    });

    return server;
};

export default buildServer;

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

const prisma = new PrismaClient();

const buildServer = async (): Promise<FastifyInstance> => {
    const server = Fastify({
        logger: true,
    });

    // Plugins
    await server.register(cors, {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    });

    await server.register(jwt, {
        secret: process.env.JWT_SECRET || 'super-secret',
    });

    // Health check
    server.get('/health', async (request, reply) => {
        return { status: 'OK', message: 'Backend is running', version: '1.0.1-' + new Date().toISOString() };
    });

    // Database test (PUBLIC temporarily for debug)
    server.get('/api/db-test', async (request, reply) => {
        try {
            const count = await prisma.booking.count();
            return { status: 'OK', count, message: 'Database connection successful' };
        } catch (err: any) {
            server.log.error(err, '[DB TEST ERROR]');
            return reply.code(500).send({ status: 'ERROR', error: err.message, stack: err.stack });
        }
    });

    server.get('/api/db-debug', async (request, reply) => {
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

    server.get('/api/diagnostics', async (request, reply) => {
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

    // ============================================================
    // ONE-TIME MIGRATION: Fix timezone sbagliato su prenotazioni esistenti.
    // Il bug applicava fromZonedTime a valori già in UTC, sottraendo
    // il fuso orario 2 volte. Questa query inverte l'operazione usando
    // AT TIME ZONE di PostgreSQL (gestisce CET/CEST automaticamente).
    // RIMUOVERE DOPO L'ESECUZIONE.
    // ============================================================
    server.get('/api/fix-timezone', async (request, reply) => {
        const { apply, key } = request.query as any;

        // Protezione con chiave segreta
        if (key !== 'fix-tz-2026') {
            return reply.code(403).send({ error: 'Chiave di sicurezza mancante o errata. Usa ?key=fix-tz-2026' });
        }

        try {
            // Prima mostra un'anteprima delle modifiche (dry-run)
            const preview = await prisma.$queryRaw`
                SELECT 
                    id,
                    "pickupAt" AS "vecchio_utc",
                    ("pickupAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Rome') AS "nuovo_utc",
                    "passengerName",
                    status
                FROM "Booking"
                WHERE status != 'CANCELLED'
                ORDER BY "pickupAt" DESC
                LIMIT 20
            `;

            if (apply === 'true') {
                // ESEGUI LA CORREZIONE
                const result = await prisma.$executeRaw`
                    UPDATE "Booking"
                    SET "pickupAt" = "pickupAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Rome'
                    WHERE status != 'CANCELLED'
                `;

                return {
                    status: 'DONE',
                    message: `Corretti ${result} record nel database.`,
                    note: 'Rimuovi questo endpoint dal codice dopo la migrazione!',
                    preview
                };
            }

            return {
                status: 'DRY_RUN',
                message: 'Anteprima delle modifiche. Aggiungi &apply=true per eseguire.',
                totalNonCancelled: await prisma.booking.count({ where: { status: { not: 'CANCELLED' } } }),
                preview
            };
        } catch (err: any) {
            server.log.error(err, '[FIX-TIMEZONE ERROR]');
            return reply.code(500).send({ error: err.message });
        }
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

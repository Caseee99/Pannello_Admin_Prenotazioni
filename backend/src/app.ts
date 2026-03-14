import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import authRoutes from './routes/auth';
import locationRoutes from './routes/locations';
import driverRoutes from './routes/drivers';
import fareRoutes from './routes/fares';
import bookingRoutes from './routes/bookings';
import emailImportRoutes from './routes/emailImports';
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

    // Public Routes
    server.register(authRoutes, { prefix: '/api/auth' });

    // Applica JWT middleware per le route protette
    server.register(async (protectedRoutes) => {
        protectedRoutes.addHook('preValidation', async (request, reply) => {
            try {
                await request.jwtVerify();
            } catch (err: any) {
                server.log.error(err, '[AUTH ERROR]');
                return reply.code(401).send({ error: 'Unauthorized', message: err.message });
            }
        });

        protectedRoutes.register(locationRoutes, { prefix: '/api/locations' });
        protectedRoutes.register(driverRoutes, { prefix: '/api/drivers' });
        protectedRoutes.register(fareRoutes, { prefix: '/api/fares' });
        protectedRoutes.register(bookingRoutes, { prefix: '/api/bookings' });
        protectedRoutes.register(emailImportRoutes, { prefix: '/api/email-imports' });
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

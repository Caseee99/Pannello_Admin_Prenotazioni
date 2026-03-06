import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import authRoutes from './routes/auth';
import locationRoutes from './routes/locations';
import driverRoutes from './routes/drivers';
import fareRoutes from './routes/fares';
import bookingRoutes from './routes/bookings';
import emailImportRoutes from './routes/emailImports';
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
        return { status: 'OK', message: 'Backend is running' };
    });

    // Public Routes
    server.register(authRoutes, { prefix: '/api/auth' });

    // Applica JWT middleware per le route protette
    server.register(async (protectedRoutes) => {
        protectedRoutes.addHook('preValidation', async (request, reply) => {
            try {
                await request.jwtVerify();
            } catch (err) {
                reply.send(err);
            }
        });

        protectedRoutes.register(locationRoutes, { prefix: '/api/locations' });
        protectedRoutes.register(driverRoutes, { prefix: '/api/drivers' });
        protectedRoutes.register(fareRoutes, { prefix: '/api/fares' });
        protectedRoutes.register(bookingRoutes, { prefix: '/api/bookings' });
        protectedRoutes.register(emailImportRoutes, { prefix: '/api/email-imports' });
    });

    return server;
};

export default buildServer;

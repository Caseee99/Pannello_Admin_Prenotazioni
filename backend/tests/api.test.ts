import { test, expect, describe, beforeAll, afterAll } from 'vitest';
import buildServer from '../src/app';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
let server: any;

beforeAll(async () => {
    server = await buildServer();
});

afterAll(async () => {
    await prisma.$disconnect();
});

describe('API Health', () => {
    test('GET /health returns OK', async () => {
        const response = await server.inject({
            method: 'GET',
            url: '/health'
        });

        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.payload).status).toBe('OK');
    });
});

describe('Authentication', () => {
    test('POST /api/auth/login with valid credentials returns JWT token', async () => {
        const response = await server.inject({
            method: 'POST',
            url: '/api/auth/login',
            payload: {
                email: process.env.EMAIL_USER || 'admin@admin.com',
                password: 'admin'
            }
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload);
        expect(body.token).toBeDefined();
    });
});

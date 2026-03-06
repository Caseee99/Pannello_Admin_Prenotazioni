import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function emailImportRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
    // Lista email importate (da processare / validate)
    fastify.get('/', async (request, reply) => {
        const { status } = request.query as any;
        const imports = await prisma.emailImport.findMany({
            where: status ? { status } : {},
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        return imports;
    });

    // Dettaglio email originale
    fastify.get('/:id', async (request, reply) => {
        const { id } = request.params as any;
        const emailData = await prisma.emailImport.findUnique({
            where: { id }
        });
        return emailData;
    });
}

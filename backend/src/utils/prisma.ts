import "dotenv/config";
import { PrismaClient } from '@prisma/client';

// Singleton pattern per PrismaClient
const prismaClientSingleton = () => {
  console.log(`[Prisma] Inizializzazione nuova istanza PrismaClient (PID: ${process.pid})`);
  
  const client = new PrismaClient({
    log: [
      { level: 'query', emit: 'stdout' },
      { level: 'info', emit: 'stdout' },
      { level: 'warn', emit: 'stdout' },
      { level: 'error', emit: 'stdout' },
    ],
  });

  // Log delle query solo se necessario per debug profondo
  // @ts-ignore
  client.$on('query', (e: any) => {
    // console.log('[Prisma Query] duration: ' + e.duration + 'ms');
    if (e.duration > 500) {
      console.warn(`[Prisma Slow Query] ${e.duration}ms: ${e.query}`);
    }
  });

  return client;
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;

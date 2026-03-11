import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
    datasourceUrl: 'postgresql://postgres.pkyksjfswgqhrjyklzva:Forzanapoli2026@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?pgbouncer=true'
});
async function main() {
    try {
        console.log('Testing connection pooler string...');
        const res = await prisma.location.findMany();
        console.log('SUCCESS, connected to DB. Found locations:', res.length);
    } catch (e) {
        console.error('ERROR:', e);
    } finally {
        await prisma.$disconnect();
    }
}
main();

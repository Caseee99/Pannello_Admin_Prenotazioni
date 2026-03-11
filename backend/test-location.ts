import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    try {
        const res = await prisma.location.create({
            data: { name: 'TestLocation', type: 'CUSTOM' }
        });
        console.log('SUCCESS:', res);
    } catch (e) {
        console.error('ERROR:', e);
    } finally {
        await prisma.$disconnect();
    }
}
main();

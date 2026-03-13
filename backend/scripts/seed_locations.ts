import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const locations = [
    { name: 'Molo Beverello', type: 'PORT' },
    { name: 'Calata Porta di Massa', type: 'PORT' },
    { name: 'Stazione Napoli Centrale', type: 'HUB' },
    { name: 'Aeroporto Capodichino', type: 'AIRPORT' },
];

async function seed() {
    console.log('--- Seeding Fixed Locations ---');
    try {
        for (const loc of locations) {
            const existing = await prisma.location.findFirst({
                where: { name: loc.name }
            });

            if (!existing) {
                await prisma.location.create({
                    data: {
                        name: loc.name,
                        type: loc.type,
                        active: true
                    }
                });
                console.log(`Created location: ${loc.name}`);
            } else {
                console.log(`Location already exists: ${loc.name}`);
            }
        }
        console.log('--- Seeding Completed ---');
    } catch (error) {
        console.error('Error during seeding:', error);
    } finally {
        await prisma.$disconnect();
    }
}

seed();

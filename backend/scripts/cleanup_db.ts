import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanup() {
    console.log('--- Database Cleanup Started ---');
    try {
        // Delete all bookings first (due to foreign keys)
        const deleteBookings = await prisma.booking.deleteMany({});
        console.log(`Deleted ${deleteBookings.count} bookings.`);

        // Delete all email imports
        const deleteEmailImports = await prisma.emailImport.deleteMany({});
        console.log(`Deleted ${deleteEmailImports.count} email imports.`);

        console.log('--- Database Cleanup Completed Successfully ---');
    } catch (error) {
        console.error('Error during cleanup:', error);
    } finally {
        await prisma.$disconnect();
    }
}

cleanup();

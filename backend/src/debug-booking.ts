import prisma from './utils/prisma';




async function debug() {
    console.log('--- DEBUG DATABASE ---');

    // 1. Cerca l'autista Gaetano Casella
    const driver = await prisma.driver.findFirst({
        where: { name: { contains: 'Gaetano' } }
    });

    if (driver) {
        console.log(`✅ Driver trovato: ${driver.name}`);
        console.log(`   Email: ${driver.email || '❌ MANCANTE'}`);
        console.log(`   Telefono: ${driver.phone}`);

        // Cerca l'ultima prenotazione per questo driver
        const lastBooking = await prisma.booking.findFirst({
            where: { driverId: driver.id },
            orderBy: { createdAt: 'desc' }
        });

        if (lastBooking) {
            console.log(`✅ Ultima prenotazione trovata: ${lastBooking.id}`);
            console.log(`   Stato Notifica: ${lastBooking.driverNotified ? 'INVIATA' : 'NON INVIATA'}`);
            console.log(`   PickupAt: ${lastBooking.pickupAt}`);
        } else {
            console.log('❌ Nessuna prenotazione trovata per questo driver.');
        }
    } else {
        console.log('❌ Driver Gaetano non trovato.');
    }

    await prisma.$disconnect();
}

debug();

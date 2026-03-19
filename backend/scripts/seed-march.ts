import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const bookingsData = [
    { date: '2026-03-01', time: '14:50', source: 'GoGo VIAGGI', origin: 'BEVERELLO', destination: 'STAZIONE C.LE', pax: 2, price: 18, driver: 'GAETANO', passenger: 'VALLETTA LAURA', phone: '3939761288' },
    { date: '2026-03-01', time: '14:53', source: 'GoGo VIAGGI', origin: 'STAZIONE C.LE', destination: 'BEVERELLO', pax: 3, price: 18, driver: 'GALIANO', passenger: 'GUANELLA PATRIZIA', phone: '3471519205' },
    { date: '2026-03-01', time: '10:40', source: 'GoGo VIAGGI', origin: 'BEVERELLO', destination: 'STAZIONE C.LE', pax: 3, price: 18, driver: 'GAETANO', passenger: 'GUANELLA PATRIZIA', phone: '3471519205' },
    { date: '2026-03-15', time: '13:43', source: 'GoGo VIAGGI', origin: 'STAZIONE C.LE', destination: 'BEVERELLO', pax: 2, price: 18, driver: null, passenger: 'PONTA LORELLA', phone: '3273256423' },
    { date: '2026-03-15', time: '13:43', source: 'GoGo VIAGGI', origin: 'STAZIONE C.LE', destination: 'BEVERELLO', pax: 2, price: 18, driver: null, passenger: 'ROVESTI LINO', phone: '3298986695' },
    { date: '2026-03-15', time: '13:43', source: 'GoGo VIAGGI', origin: 'STAZIONE C.I.F', destination: 'BEVERELLO', pax: 2, price: 18, driver: null, passenger: 'GUASTINI PATRIZIA', phone: '3282718519' },
    { date: '2026-03-15', time: '15:28', source: 'GoGo VIAGGI', origin: 'STAZIONE C.LE', destination: 'BEVERELLO', pax: 2, price: 18, driver: null, passenger: 'GASPERINI GABRIELLE', phone: '3298024883' },
    { date: '2026-03-20', time: '11:50', source: 'JESSICA', origin: 'STAZIONE C.LE', destination: 'MAJESTIC HOTEL', pax: 13, price: 65, driver: null, passenger: 'JESSICA', phone: '' },
    { date: '2026-03-22', time: '10:40', source: 'GoGo VIAGGI', origin: 'BEVERELLO', destination: 'STAZIONE C.LE', pax: 2, price: 18, driver: null, passenger: 'PONTA LORELLA', phone: '3273256423' },
    { date: '2026-03-22', time: '10:40', source: 'GoGo VIAGGI', origin: 'BEVERELLO', destination: 'STAZIONE C.LE', pax: 2, price: 18, driver: null, passenger: 'GASPERINI GABRIELLE', phone: '3298024883' },
    { date: '2026-03-22', time: '10:40', source: 'GoGo VIAGGI', origin: 'BEVERELLO', destination: 'STAZIONE C.LE', pax: 2, price: 18, driver: null, passenger: 'GUASTINI PATRIZIA', phone: '3282718519' },
    { date: '2026-03-22', time: '10:53', source: 'GoGo VIAGGI', origin: 'STAZIONE C.LE', destination: 'BEVERELLO', pax: 1, price: 18, driver: null, passenger: 'TURRISI MARIA LUANA', phone: '3928417018' },
    { date: '2026-03-22', time: '12:20', source: 'GoGo VIAGGI', origin: 'AEROPORTO', destination: 'BEVERELLO', pax: 1, price: 35, driver: null, passenger: 'FAGIANI ANTONELLA', phone: '3498942630' },
    { date: '2026-03-22', time: '12:53', source: 'GoGo VIAGGI', origin: 'STAZIONE C.LE', destination: 'BEVERELLO', pax: 4, price: 18, driver: null, passenger: 'PARENTI GIOVANNI', phone: '3474728201' },
    { date: '2026-03-22', time: '12:53', source: 'GoGo VIAGGI', origin: 'STAZIONE C.LE', destination: 'BEVERELLO', pax: 2, price: 18, driver: null, passenger: 'DI PINTO GIUSEPPE', phone: '3314440471' },
    { date: '2026-03-22', time: '13:43', source: 'GoGo VIAGGI', origin: 'STAZIONE C.I.F', destination: 'BEVERELLO', pax: 2, price: 18, driver: null, passenger: 'TACCONI ERNESTINA', phone: '3771300997' },
    { date: '2026-03-22', time: '15:30', source: 'JESSICA', origin: 'MAJESTIC HOTEL', destination: 'STAZIONE C.LE', pax: 13, price: 65, driver: null, passenger: 'JESSICA', phone: '' },
    { date: '2026-03-29', time: '10:40', source: 'GoGo VIAGGI', origin: 'BEVERELLO', destination: 'STAZIONE C.LE', pax: 1, price: 18, driver: null, passenger: 'TURRISI MARIA LUANA', phone: '3928417018' },
    { date: '2026-03-29', time: '10:40', source: 'GoGo VIAGGI', origin: 'BEVERELLO', destination: 'STAZIONE C.LE', pax: 2, price: 18, driver: null, passenger: 'TACCONI ERNESTINA', phone: '3771300997' },
    { date: '2026-03-29', time: '10:40', source: 'GoGo VIAGGI', origin: 'BEVERELLO', destination: 'STAZIONE C.LE', pax: 1, price: 18, driver: null, passenger: 'PARENTI GIOVANNI', phone: '3474728201' },
    { date: '2026-03-29', time: '10:40', source: 'GoGo VIAGGI', origin: 'BEVERELLO', destination: 'STAZIONE C.LE', pax: 2, price: 18, driver: null, passenger: 'DI PINTO GIUSEPPE', phone: '3314440471' },
    { date: '2026-03-29', time: '12:30', source: 'GoGo VIAGGI', origin: 'BEVERELLO', destination: 'STAZIONE C.LE', pax: 2, price: 18, driver: null, passenger: 'ROVESTI LINO', phone: '3298986695' },
    { date: '2026-03-29', time: '14:50', source: 'GoGo VIAGGI', origin: 'BEVERELLO', destination: 'AEROPORTO', pax: 1, price: 35, driver: null, passenger: 'FAGIANI ANTONELLA', phone: '3498942630' },
];

async function main() {
    console.log('--- Seeding March 2026 Bookings ---');

    for (const b of bookingsData) {
        try {
            console.log(`\nProcessing booking for ${b.passenger} on ${b.date} ${b.time}`);
            
            // Find or create origin
            let origin = await prisma.location.findFirst({ where: { name: b.origin } });
            if (!origin) {
                console.log(`Creating origin: ${b.origin}`);
                origin = await prisma.location.create({
                    data: { name: b.origin, type: b.origin.includes('AEROPORTO') ? 'AIRPORT' : 'HUB' }
                });
            } else {
                console.log(`Found origin: ${b.origin} (${origin.id})`);
            }

            // Find or create destination
            let destination = await prisma.location.findFirst({ where: { name: b.destination } });
            if (!destination) {
                console.log(`Creating destination: ${b.destination}`);
                destination = await prisma.location.create({
                    data: { name: b.destination, type: b.destination.includes('AEROPORTO') ? 'AIRPORT' : 'HUB' }
                });
            } else {
                console.log(`Found destination: ${b.destination} (${destination.id})`);
            }

            // Find or create driver
            let driverId = null;
            if (b.driver) {
                let driver = await prisma.driver.findFirst({ where: { name: { contains: b.driver, mode: 'insensitive' } } });
                if (!driver) {
                    console.log(`Creating driver: ${b.driver}`);
                    driver = await prisma.driver.create({
                        data: {
                            name: b.driver,
                            phone: '0000000000',
                            licensePlate: 'CP-TEMP',
                            seats: 4
                        }
                    });
                } else {
                    console.log(`Found driver: ${b.driver} (${driver.id})`);
                }
                driverId = driver.id;
            }

            const pickupAt = new Date(`${b.date}T${b.time}:00`);

            await prisma.booking.create({
                data: {
                    pickupAt,
                    passengers: b.pax,
                    passengerName: b.passenger || b.source,
                    passengerPhone: b.phone,
                    status: driverId ? 'ASSIGNED' : 'CONFIRMED',
                    driverId,
                    originId: origin.id,
                    destinationId: destination.id,
                    source: b.source,
                    notes: `Imported from March Excel. Price: €${b.price}`
                }
            });
            console.log(`Successfully created booking for ${b.passenger}`);
        } catch (err: any) {
            console.error(`FAILED to create booking for ${b.passenger}:`, err.message);
            if (err.meta) console.error('Error Meta:', JSON.stringify(err.meta, null, 2));
            throw err; // Stop on first error for debugging
        }
    }

    console.log('--- Seed Finished ---');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

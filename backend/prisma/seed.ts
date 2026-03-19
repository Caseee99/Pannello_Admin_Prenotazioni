import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding database...');

    // 1. Locations
    const beverello = await prisma.location.create({
        data: { name: 'Molo Beverello', type: 'PORT' }
    });
    const portaMassa = await prisma.location.create({
        data: { name: 'Calata Porta di Massa', type: 'PORT' }
    });
    const stazione = await prisma.location.create({
        data: { name: 'Stazione Centrale Napoli', type: 'HUB' }
    });
    const capodichino = await prisma.location.create({
        data: { name: 'Aeroporto Napoli (Capodichino)', type: 'AIRPORT' }
    });

    const locations = [beverello, portaMassa, stazione, capodichino];

    console.log('Created Locations');

    // 2. Fares (18 EUR per tutte le tratte normali, ma mettiamo 35 per l'aeroporto)
    await prisma.fare.create({ data: { originId: stazione.id, destinationId: beverello.id, amount: 18, currency: 'EUR' } });
    await prisma.fare.create({ data: { originId: beverello.id, destinationId: stazione.id, amount: 18, currency: 'EUR' } });

    await prisma.fare.create({ data: { originId: stazione.id, destinationId: portaMassa.id, amount: 18, currency: 'EUR' } });
    await prisma.fare.create({ data: { originId: portaMassa.id, destinationId: stazione.id, amount: 18, currency: 'EUR' } });

    await prisma.fare.create({ data: { originId: capodichino.id, destinationId: beverello.id, amount: 35, currency: 'EUR' } });
    await prisma.fare.create({ data: { originId: beverello.id, destinationId: capodichino.id, amount: 35, currency: 'EUR' } });

    await prisma.fare.create({ data: { originId: capodichino.id, destinationId: portaMassa.id, amount: 35, currency: 'EUR' } });
    await prisma.fare.create({ data: { originId: portaMassa.id, destinationId: capodichino.id, amount: 35, currency: 'EUR' } });

    console.log('Created Fares');

    // 3. Drivers
    const driverNames = ['Mario Rossi', 'Luigi Bianchi', 'Giuseppe Verdi', 'Antonio Esposito', 'Ciro Romano'];
    const drivers = [];

    for (let i = 0; i < driverNames.length; i++) {
        const driver = await prisma.driver.create({
            data: {
                name: driverNames[i],
                phone: `+39 333 123450${i}`
            }
        });
        drivers.push(driver);

        const today = new Date();
        const currentDay = today.getDay();
        const diff = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
        const monday = new Date(today.setDate(diff));
        monday.setHours(0, 0, 0, 0);

        await prisma.availability.create({
            data: {
                driverId: driver.id,
                weekStart: monday,
                mon: true, tue: true, wed: true, thu: true, fri: true, sat: i % 2 === 0, sun: false
            }
        });
    }

    console.log('Created Drivers & Availability');

    // 4. Sample Email Import & Bookings
    const sampleEmail = await prisma.emailImport.create({
        data: {
            rawContent: "Email di test per andata e ritorno...",
            status: 'COMPLETED',
            parsedJson: JSON.stringify([
                { origin: "Stazione", destination: "Beverello", passengersCount: 3 }
            ])
        }
    });

    const statuses = ['DRAFT', 'CONFIRMED', 'ASSIGNED', 'COMPLETED', 'CANCELLED'];

    for (let i = 0; i < 10; i++) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + (i % 5));
        futureDate.setHours(10 + i, 30, 0, 0);

        const isAssigned = i >= 2 && i <= 3;
        const isCompleted = i === 4;

        const bStatus =
            isCompleted ? 'COMPLETED'
                : isAssigned ? 'ASSIGNED'
                    : statuses[i % statuses.length];

        await prisma.booking.create({
            data: {
                pickupAt: futureDate,
                originId: i % 2 === 0 ? stazione.id : capodichino.id,
                destinationId: beverello.id,
                passengers: 2 + (i % 3),
                passengerName: `Cliente Test ${i}`,
                passengerPhone: `+39 349 98765${i}`,
                status: bStatus,
                driverId: (isAssigned || isCompleted) ? drivers[i % 5].id : null,
                emailImportId: i === 0 ? sampleEmail.id : null,
                notes: "Seed test corsa"
            }
        });
    }

    console.log('Created Bookings');
    console.log('Seeding completed successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

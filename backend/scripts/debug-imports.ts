import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n====== EMAIL IMPORTS IN DB ======');
    const imports = await prisma.emailImport.findMany({ orderBy: { createdAt: 'asc' } });

    for (const imp of imports) {
        console.log(`\n📧 EmailImport: ${imp.id} [${imp.status}]`);
        if (imp.parsedJson) {
            const parsed = JSON.parse(imp.parsedJson);
            parsed.forEach((b: any, i: number) => {
                console.log(`  [${i + 1}] actionType="${b.actionType}" | externalRef="${b.externalRef}" | pickupDateTime="${b.pickupDateTime}" | PNR+date="${b.externalRef}_${b.pickupDateTime?.split('T')[0]}"`);
                console.log(`       Origin="${b.origin}" → Dest="${b.destination}" | Pax="${b.passengerName}"`);
            });
        }
    }

    console.log('\n====== BOOKINGS IN DB ======');
    const bookings = await prisma.booking.findMany({
        include: { origin: true, destination: true },
        orderBy: { pickupAt: 'asc' }
    });
    for (const b of bookings) {
        console.log(`  📌 ${b.id} | status=${b.status} | externalRef="${b.externalRef}" | pickupAt=${b.pickupAt.toISOString()} | ${b.passengerName}`);
    }

    await prisma.$disconnect();
}

main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });

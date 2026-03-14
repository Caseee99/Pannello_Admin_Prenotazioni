import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const agencyName = 'GoGO VIAGGI';

    console.log(`Cerco agenzia con nome esatto: "${agencyName}"...`);
    const agency = await prisma.agency.findFirst({
        where: { name: agencyName },
    });

    if (!agency) {
        console.error(`Agenzia "${agencyName}" non trovata. Assicurati che il nome coincida esattamente.`);
        process.exit(1);
    }

    console.log(`Trovata agenzia: ${agency.name} (id=${agency.id}). Aggancio prenotazioni esistenti...`);

    const result = await prisma.booking.updateMany({
        where: {
            agencyId: null,
            agency: agencyName,
        },
        data: {
            agencyId: agency.id,
        },
    });

    console.log(`Prenotazioni aggiornate per "${agencyName}": ${result.count}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });


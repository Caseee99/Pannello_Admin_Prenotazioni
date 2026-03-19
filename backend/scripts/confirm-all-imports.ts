/**
 * Script: confirm-all-imports.ts
 * Conferma tutti gli EmailImport in stato PENDING_REVIEW applicando la nuova logica
 * (externalRef = PNR_data per distinguere andata e ritorno).
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper: trova o crea una Location per nome
async function findOrCreateLocation(name: string | null): Promise<string | null> {
    if (!name) return null;
    const normalized = name.trim();
    const existing = await prisma.location.findFirst({
        where: { name: { equals: normalized, mode: 'insensitive' } }
    });
    if (existing) return existing.id;
    const created = await prisma.location.create({
        data: { name: normalized, type: 'CUSTOM', active: true }
    });
    console.log(`  📍 Nuova Location creata: "${normalized}"`);
    return created.id;
}

async function main() {
    const imports = await prisma.emailImport.findMany({
        where: { status: 'PENDING_REVIEW' },
        orderBy: { createdAt: 'asc' }
    });

    console.log(`\n🔄 Confermando ${imports.length} email import(s)...\n`);

    for (const emailImport of imports) {
        if (!emailImport.parsedJson) continue;
        const bookingsData = JSON.parse(emailImport.parsedJson);
        console.log(`📧 Import: ${emailImport.id}`);

        for (const data of bookingsData) {
            const actionType = (data.actionType || 'CREATE').toUpperCase();

            // Calcola externalRef: PNR + data prelievo (per distinguere andata/ritorno)
            const baseRef = data.externalRef || (() => {
                const namePart = (data.passengerName || 'noname').replace(/\s+/g, '').toLowerCase();
                return `auto_${namePart}`;
            })();
            const dateSuffix = data.pickupDateTime
                ? '_' + new Date(data.pickupDateTime).toISOString().split('T')[0]
                : '_nodate';
            const externalRefValue = `${baseRef}${dateSuffix}`;

            console.log(`  → actionType=${actionType} | externalRef="${externalRefValue}" | ${data.passengerName} | ${data.pickupDateTime}`);

            // ANNULLAMENTO
            if (actionType === 'CANCEL') {
                const toCancel = await prisma.booking.findMany({
                    where: { externalRef: { startsWith: baseRef } }
                });
                for (const b of toCancel) {
                    await prisma.booking.update({ where: { id: b.id }, data: { status: 'CANCELLED' } });
                    console.log(`     ✅ CANCELLATO: ${b.id}`);
                }
                if (toCancel.length === 0) console.warn(`     ⚠️  Nessuna prenotazione trovata per cancellare (PNR: ${baseRef})`);
                continue;
            }

            // Risolvi Location
            const originId = await findOrCreateLocation(data.origin || null);
            const destinationId = await findOrCreateLocation(data.destination || null);

            const bookingData = {
                pickupAt: data.pickupDateTime ? new Date(data.pickupDateTime) : new Date(),
                passengers: data.passengersCount || 1,
                passengerName: data.passengerName || 'N/A',
                passengerPhone: data.passengerPhone || '',
                notes: data.notes || '',
                source: 'Email',
                externalRef: externalRefValue,
                emailImportId: emailImport.id,
                originId,
                destinationId,
            };

            const existing = await prisma.booking.findFirst({ where: { externalRef: externalRefValue } });
            if (existing && actionType === 'UPDATE') {
                await prisma.booking.update({ where: { id: existing.id }, data: bookingData });
                console.log(`     ✅ AGGIORNATO: ${existing.id}`);
            } else if (!existing) {
                const b = await prisma.booking.create({ data: { ...bookingData, status: 'CONFIRMED' } });
                console.log(`     ✅ CREATO: ${b.id}`);
            } else {
                // actionType=CREATE ma esiste già → update comunque per sicurezza
                await prisma.booking.update({ where: { id: existing.id }, data: bookingData });
                console.log(`     ♻️  EXISTS+UPDATE: ${existing.id}`);
            }
        }

        await prisma.emailImport.update({ where: { id: emailImport.id }, data: { status: 'PROCESSED' } });
    }

    console.log('\n====== PRENOTAZIONI FINALI ======');
    const bookings = await prisma.booking.findMany({
        include: { origin: true, destination: true },
        orderBy: { pickupAt: 'asc' }
    });
    bookings.forEach(b => {
        console.log(`  📌 ${b.passengerName} | ${new Date(b.pickupAt).toLocaleDateString('it-IT')} | ${b.origin?.name || '---'} → ${b.destination?.name || '---'} | externalRef="${b.externalRef}"`);
    });

    console.log(`\n✅ Totale prenotazioni: ${bookings.length}`);
    await prisma.$disconnect();
}

main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });

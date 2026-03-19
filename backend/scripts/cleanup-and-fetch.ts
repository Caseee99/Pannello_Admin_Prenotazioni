/**
 * Script: cleanup-and-fetch.ts
 * 1) Svuota tutte le prenotazioni e le email importate
 * 2) Effettua una lettura live dalla cartella "Lavoro 2"
 * 3) Inserisce le email come EmailImport nel DB (come farebbe il polling)
 *
 * Eseguire con: npx ts-node scripts/cleanup-and-fetch.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { fetchUnreadEmails } from '../src/services/imapService';
import { parseEmailContentWithGemini } from '../src/services/geminiService';

const prisma = new PrismaClient();

async function main() {
    console.log('\n========== PULIZIA DATABASE ==========');
    // L'ordine è importante: prima si eliminano i dati dipendenti (Payment, poi Booking, poi EmailImport)
    const deletedPayments = await prisma.payment.deleteMany({});
    console.log(`✅ Eliminati ${deletedPayments.count} pagamenti`);

    const deletedBookings = await prisma.booking.deleteMany({});
    console.log(`✅ Eliminati ${deletedBookings.count} prenotazioni`);

    const deletedImports = await prisma.emailImport.deleteMany({});
    console.log(`✅ Eliminati ${deletedImports.count} email importate`);

    console.log('\n========== LETTURA EMAIL LIVE ==========');
    const emails = await fetchUnreadEmails();

    if (!emails || emails.length === 0) {
        console.log('⚠️  Nessuna email non letta trovata nella cartella "Lavoro 2".');
        console.log('   Controlla che le email siano NON LETTE (non segnate come lette) nella casella.');
        await prisma.$disconnect();
        return;
    }

    console.log(`\n📬 ${emails.length} email trovate. Parsing con Gemini...`);

    for (const email of emails) {
        const fullContent = `Subject: ${email.subject}\nFrom: ${email.from}\nDate: ${email.date}\n\n${email.text || email.html || ''}`;
        console.log(`\n--- Elaborazione email: "${email.subject}" ---`);

        try {
            const parsed = await parseEmailContentWithGemini(fullContent);
            const emailImport = await prisma.emailImport.create({
                data: {
                    rawContent: fullContent,
                    parsedJson: JSON.stringify(parsed),
                    status: 'PENDING_REVIEW',
                }
            });
            console.log(`✅ EmailImport creato: ${emailImport.id} (${parsed.length} booking(s) estratti)`);
        } catch (err) {
            console.error(`❌ Errore parsing email "${email.subject}":`, err);
            // Salva comunque come NEEDS_REVIEW
            await prisma.emailImport.create({
                data: {
                    rawContent: fullContent,
                    parsedJson: null,
                    status: 'NEEDS_REVIEW',
                }
            });
        }
    }

    console.log('\n========== COMPLETATO ==========');
    console.log('Ora apri il pannello su http://localhost:5173/bookings per revisionare e confermare le email.');
    await prisma.$disconnect();
}

main().catch((err) => {
    console.error('Errore fatale:', err);
    prisma.$disconnect();
    process.exit(1);
});

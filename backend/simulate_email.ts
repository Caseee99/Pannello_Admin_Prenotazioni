import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const mockEmailContent = `
Oggetto: Nuova prenotazione Transfer - Urgente
Data: Thu, 05 Mar 2026 14:00:00 +0100
Da: agenzia.viaggi@example.com

Buongiorno,
si richiede la disponibilità di
il 01-03-2026 TRANSFER DI ARRIVO DA STAZIONE A MOLO BEVERELLO alle ore 14:53
Da: NAPOLI STAZIONE CENTRALE
A: NAPOLI BEVERELLO

3 posti per le seguenti persone:
GUANELLA PATRIZIA Cell: 3471519205
BASSI PAOLA Cell: 349 2256440

3 adulti, Costo: € 18,00
ARRIVO DA MILANO C.LE CON ITALO 9977

il 08-03-2026 TRANSFER DI RIENTRO DA MOLO BEVERELLO A STAZIONE I alle ore 10:40
Da: NAPOLI BEVERELLO
A: NAPOLI STAZIONE CENTRALE

Ritorno delle stesse persone. GRAZIE.
`;

async function main() {
    console.log('Inserting mock email for Gemini processing test...');

    const emailImport = await prisma.emailImport.create({
        data: {
            rawContent: mockEmailContent,
            status: 'PROCESSING'
        }
    });

    console.log(`Email Import ID ${emailImport.id} created.`);

    // Triggers the processor logic imported from the app
    const { parseEmailContentWithGemini } = await import('./src/services/geminiService');

    try {
        const parsedJson = await parseEmailContentWithGemini(mockEmailContent);
        console.log('Gemini Extracted Data:', JSON.stringify(parsedJson, null, 2));

        await prisma.emailImport.update({
            where: { id: emailImport.id },
            data: {
                status: 'PENDING_REVIEW',
                parsedJson: JSON.stringify(parsedJson)
            }
        });
        console.log('Test completed successfully, check Frontend App.');
    } catch (err) {
        console.error('Test Failed:', err);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());

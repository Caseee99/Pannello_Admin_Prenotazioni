import { fetchUnreadEmails } from './imapService';
import { parseEmailContentWithGemini } from './geminiService';
import { PrismaClient } from '@prisma/client';
import { fromZonedTime } from 'date-fns-tz';

const prisma = new PrismaClient();
const TIMEZONE = 'Europe/Rome';

export async function processNewEmails() {
    console.log('[Processor] Avvio ciclo processamento email...');

    // 1. Fetch
    const newEmails = await fetchUnreadEmails();
    console.log(`[Processor] Ricevute ${newEmails.length} email dal servizio IMAP.`);
    
    if (newEmails.length === 0) {
        console.log('[Processor] Nessuna email da processare.');
        return;
    }

    for (const email of newEmails) {
        console.log(`[Processor] Inizio elaborazione email: "${email.subject}" da ${email.from}`);
        const rawContent = `Oggetto: ${email.subject}\nData: ${email.date}\nDa: ${email.from}\n\nCorpo:\n${email.text || email.html}`;

        // 2. Salva email nel DB immediatamente (nessuna perdita dati)
        let emailImport = await prisma.emailImport.create({
            data: {
                rawContent,
                status: 'PROCESSING'
            }
        });

        console.log(`[Processor] Creata EmailImport ID ${emailImport.id} nel database.`);

        // 3. Parsing LLM
        console.log(`[Processor] Invio contenuto a Gemini per il parsing (ID ${emailImport.id})...`);
        let parsedJson = null;
        try {
            parsedJson = await parseEmailContentWithGemini(rawContent);

            if (!Array.isArray(parsedJson)) {
                throw new Error("Gemini non ha restituito un array.");
            }

            console.log(`[Processor] Gemini ha restituito ${parsedJson.length} potenziali prenotazioni per l'email ID ${emailImport.id}.`);

            // Validazione manuale basi prima di inserire
            const bookingsToCreate = [];
            let needsReview = false;

            for (const item of parsedJson) {
                // Se i campi critici sono mancanti (null), andrà in NEEDS_REVIEW
                if (!item.pickupDateTime || !item.origin || !item.destination) {
                    needsReview = true;
                }
                bookingsToCreate.push(item);
            }

            // 4. Aggiorna EmailImport e crea i Bookings
            const updateStatus = needsReview ? 'NEEDS_REVIEW' : 'PENDING_REVIEW';
            console.log(`[Processor] Stato finale EmailImport ID ${emailImport.id}: ${updateStatus}`);

            await prisma.emailImport.update({
                where: { id: emailImport.id },
                data: {
                    parsedJson: JSON.stringify(bookingsToCreate),
                    status: updateStatus
                }
            });

            // Crea Booking elements solo se LLM va a buon fine, se ci sono campi null, saranno comunque creati 
            // ma l'admin dalla dashboard (NEEDS_REVIEW) dovrà compilare i buchi
            // Crea Booking elements solo se LLM va a buon fine
            for (const bookingData of bookingsToCreate) {
                const isCancellation = (bookingData.notes || "").toUpperCase().includes("ATTENZIONE: RICHIESTA DI CANCELLAZIONE");

                // Tentativo di match con agenzia esistente per ID
                let matchedAgencyId = null;
                if (bookingData.agency) {
                    const agency = await prisma.agency.findFirst({
                        where: { 
                            name: { equals: bookingData.agency, mode: 'insensitive' }
                        }
                    });
                    if (agency) matchedAgencyId = agency.id;
                }

                await prisma.booking.create({
                    data: {
                        pickupAt: bookingData.pickupDateTime ? fromZonedTime(bookingData.pickupDateTime, TIMEZONE) : new Date(0), // data placeholder se null
                        passengers: bookingData.passengersCount || 1,
                        passengerName: bookingData.passengerName || 'Sconosciuto',
                        passengerPhone: bookingData.passengerPhone,
                        notes: bookingData.notes,
                        status: isCancellation ? 'CANCELLED' : 'DRAFT',
                        source: 'Email Agency',
                        agencyId: matchedAgencyId,
                        agency: bookingData.agency,
                        emailImportId: emailImport.id,
                        // origin e destination non li leghiamo strettamente subito se non ci sono match ID (per ora rimangono in note o liberi per admin)
                        // In T5 la dashboard manderà originId / destinationId corretto mappato al DB manually by Admin.
                    }
                });
            }

            console.log(`[Processor] JSON parsato con successo e ${bookingsToCreate.length} prenotazioni DRAFT/CANCELLED create per EmailImport ID ${emailImport.id}.`);
        } catch (err) {
            console.error(`[Processor] Errore critico nel parsing dell'emailImportId ${emailImport.id}:`, err);

            // Retry (semplice fallback a ERROR)
            await prisma.emailImport.update({
                where: { id: emailImport.id },
                data: { status: 'ERROR' }
            });
        }
    }

    console.log('[Processor] Ciclo processamento concluso.');
}

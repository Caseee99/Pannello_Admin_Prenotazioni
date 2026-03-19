import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function emailImportRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
    // Lista email importate (da processare / validate)
    fastify.get('/', async (request, reply) => {
        const { status } = request.query as any;
        const imports = await prisma.emailImport.findMany({
            where: status ? { status } : {},
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        return imports;
    });

    // Dettaglio email originale
    fastify.get('/:id', async (request, reply) => {
        const { id } = request.params as any;
        const emailData = await prisma.emailImport.findUnique({
            where: { id }
        });
        return emailData;
    });

    // Conferma importazione creando le prenotazioni
    fastify.patch('/:id/confirm', async (request, reply) => {
        const { id } = request.params as { id: string };
        const emailImport = await prisma.emailImport.findUnique({ where: { id } });
        if (!emailImport || !emailImport.parsedJson) return reply.code(400).send({ error: 'Import non trovato o non parsato' });

        const bookingsData = JSON.parse(emailImport.parsedJson);
        const results = [];

        // Helper: trova o crea una Location per nome
        const findOrCreateLocation = async (name: string | null): Promise<string | null> => {
            if (!name) return null;
            const normalized = name.trim();
            // Cerca Location esistente (case-insensitive)
            const existing = await prisma.location.findFirst({
                where: { name: { equals: normalized, mode: 'insensitive' } }
            });
            if (existing) return existing.id;
            // Crea nuova Location
            const created = await prisma.location.create({
                data: { name: normalized, type: 'CUSTOM', active: true }
            });
            console.log(`[EmailImport] Nuova Location creata: "${normalized}" (id: ${created.id})`);
            return created.id;
        };

        // Crea o Aggiorna le prenotazioni
        for (const data of bookingsData) {
            const actionType = (data.actionType || 'CREATE').toUpperCase();

            // Calcola externalRef univoco per ogni TRATTA (non solo per email/PNR)
            // Combinando PNR + data del prelievo si evita che andata e ritorno si sovrascrivano
            const baseRef = data.externalRef || (() => {
                const namePart = (data.passengerName || 'noname').replace(/\s+/g, '').toLowerCase();
                return `auto_${namePart}`;
            })();

            // Aggiungi la data del prelievo come suffisso → rende unica ogni tratta dello stesso PNR
            const dateSuffix = data.pickupDateTime
                ? '_' + new Date(data.pickupDateTime).toISOString().split('T')[0]
                : '_nodate';
            const externalRefValue = `${baseRef}${dateSuffix}`;

            // --- CANCELLAZIONE AUTOMATICA ---
            if (actionType === 'CANCEL') {
                // Cerca TUTTE le tratte con il baseRef (sia andata che ritorno condividono lo stesso PNR base)
                const bookingsToCancel = await prisma.booking.findMany({
                    where: { externalRef: { startsWith: baseRef } }
                });
                if (bookingsToCancel.length > 0) {
                    for (const b of bookingsToCancel) {
                        const cancelled = await prisma.booking.update({
                            where: { id: b.id },
                            data: { status: 'CANCELLED' }
                        });
                        console.log(`[EmailImport] Prenotazione CANCELLATA: ${b.id} (externalRef: ${b.externalRef})`);
                        results.push({ action: 'CANCELLED', booking: cancelled });
                    }
                } else {
                    console.warn(`[EmailImport] Cancellazione richiesta ma nessuna tratta trovata per PNR: ${baseRef}`);
                    results.push({ action: 'CANCEL_NOT_FOUND', externalRef: baseRef });
                }
                continue; // passa al prossimo elemento
            }

            // --- CREA O AGGIORNA ---

            // Risolvi Origin e Destination come Location nel DB
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
                emailImportId: id,
                originId,
                destinationId,
            };

            const existingBooking = await prisma.booking.findFirst({
                where: { externalRef: externalRefValue }
            });

            if (existingBooking && actionType === 'UPDATE') {
                // UPDATE se esiste ed è una modifica
                const b = await prisma.booking.update({
                    where: { id: existingBooking.id },
                    data: bookingData
                });
                results.push({ action: 'UPDATED', booking: b });
            } else if (!existingBooking) {
                // CREATE se non c'è ancora
                const b = await prisma.booking.create({
                    data: { ...bookingData, status: 'CONFIRMED' }
                });
                results.push({ action: 'CREATED', booking: b });
            } else {
                // Record esistente ma actionType=CREATE (raro): skip/aggiorna ugualmente
                const b = await prisma.booking.update({
                    where: { id: existingBooking.id },
                    data: bookingData
                });
                results.push({ action: 'UPDATED', booking: b });
            }
        }

        await prisma.emailImport.update({
            where: { id },
            data: { status: 'PROCESSED' }
        });

        return { success: true, results };
    });

    fastify.patch('/:id/discard', async (request, reply) => {
        const { id } = request.params as { id: string };
        await prisma.emailImport.update({
            where: { id },
            data: { status: 'DISCARDED' }
        });
        return { success: true };
    });
}

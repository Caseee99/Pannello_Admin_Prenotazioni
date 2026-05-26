import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { sendAssignmentEmail, AssignmentEmailPayload } from './mailerService';
import fs from 'fs';
import path from 'path';
import { maskEmail } from '../utils/privacy';

type BookingWithInclusions = Prisma.BookingGetPayload<{
    include: {
        origin: true;
        destination: true;
        driver: true;
    };
}>;

/**
 * Invia manualmente l'email di notifica a un autista specifico per una determinata prenotazione.
 * Aggiorna il flag driverNotified a true se l'autista notificato corrisponde a quello attualmente assegnato.
 */
export async function sendManualEmailNotification(
    bookingId: string,
    driverId: string
): Promise<void> {
    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
            origin: true,
            destination: true,
            driver: true,
        },
    }) as BookingWithInclusions | null;

    if (!booking) {
        throw new Error('Prenotazione non trovata.');
    }

    const driver = await prisma.driver.findUnique({
        where: { id: driverId },
    });

    if (!driver) {
        throw new Error('Autista non trovato.');
    }

    if (!driver.email) {
        throw new Error(`L'autista ${driver.name} non ha un indirizzo email configurato.`);
    }

    try {
        const payload: AssignmentEmailPayload = {
            id: booking.id,
            pickupAt: booking.pickupAt,
            passengerName: booking.passengerName,
            passengerPhone: booking.passengerPhone,
            passengers: booking.passengers,
            notes: booking.notes,
            origin: booking.origin ?? { name: booking.originRaw ?? 'Non specificato' },
            destination: booking.destination ?? { name: booking.destinationRaw ?? 'Non specificato' },
            driver: {
                name: driver.name,
                email: driver.email,
                phone: driver.phone,
            },
            isReminder: false,
        };

        // Aggiungiamo un timeout di 6 secondi per l'invio
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('SMTP_TIMEOUT')), 6000));
        await Promise.race([sendAssignmentEmail(payload), timeout]);

        // Se l'autista a cui abbiamo inviato l'email è l'autista attualmente assegnato alla prenotazione,
        // aggiorniamo driverNotified su true
        if (booking.driverId === driverId) {
            await prisma.booking.update({
                where: { id: booking.id },
                data: { driverNotified: true },
            });
        }

        console.log(
            `[NotificationService] ✅ Email inviata manualmente per la prenotazione ${booking.id} all'autista ${driver.name} (${maskEmail(driver.email)})`
        );
    } catch (err: any) {
        if (err.message === 'SMTP_TIMEOUT') {
            throw new Error("Timeout durante l'invio dell'email. Riprova tra poco.");
        }

        const errorMsg = `[NotificationService] ❌ Errore notifica manuale per prenotazione ${booking.id} a autista ${driver.name}: ${err.message}`;
        console.error(errorMsg);

        try {
            fs.appendFileSync(path.join(process.cwd(), 'notification-errors.log'), `${new Date().toISOString()} - ${errorMsg}\n`);
        } catch (e) { }

        throw err;
    }
}

import nodemailer from 'nodemailer';
import { it } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';

// ── Configurazione SMTP (es: Gmail, Mailjet SMTP, etc.) ──────────────────────
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM_EMAIL = process.env.SMTP_FROM || 'info@consorziotaxi2000.it';
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || 'Consorzio Jubilee 25 Tour';

const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // true per 465, false per altre porte
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
    },
});

console.log(`[MailerService] Configurazione Email inizializzata:`);
console.log(`[MailerService]   Host: ${SMTP_HOST || 'MANCANTE ⚠️'}`);
console.log(`[MailerService]   User: ${SMTP_USER || 'MANCANTE ⚠️'}`);
console.log(`[MailerService]   From: ${SMTP_FROM_NAME} <${SMTP_FROM_EMAIL}>`);

export interface AssignmentEmailPayload {
    id: string;
    pickupAt: Date;
    passengerName: string | null;
    passengerPhone: string | null;
    passengers: number;
    notes: string | null;
    origin: { name: string };
    destination: { name: string };
    driver: {
        name: string;
        email: string | null;
        phone: string;
    };
    isReminder: boolean;
}

/**
 * Invia email di assegnazione corsa al driver.
 * Prova prima via SMTP (Nodemailer), utile per test e host che lo permettono.
 */
export async function sendAssignmentEmail(payload: AssignmentEmailPayload): Promise<void> {
    const { driver, pickupAt, origin, destination, isReminder } = payload;

    if (!driver.email) {
        const msg = `[MailerService] Driver ${driver.name} non ha email. Impossibile inviare notifica.`;
        console.warn(msg);
        throw new Error(msg);
    }

    const dataOra = formatInTimeZone(pickupAt, 'Europe/Rome', "eeee d MMMM 'alle' HH:mm", { locale: it });
    const subjectPrefix = isReminder ? "[PROMEMORIA] " : "[NUOVA CORSA] ";

    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <div style="background: linear-gradient(135deg, #11355a 0%, #1a5276 100%); padding: 30px; text-align: center;">
                <h2 style="color: white; margin: 0; font-size: 22px; font-weight: bold; letter-spacing: 0.5px;">
                    ${isReminder ? '⏰ Promemoria Corsa Imminente' : '🚖 Nuova Corsa Assegnata'}
                </h2>
            </div>
            
            <div style="padding: 30px; background-color: white;">
                <p style="color: #333; font-size: 16px;">Gentile <strong>${driver.name}</strong>,</p>
                <p style="color: #555; font-size: 15px; line-height: 1.5;">
                    ${isReminder ? 'Ti ricordiamo la seguente corsa in programma tra 15 minuti:' : 'Ti è stata assegnata una nuova corsa. Ecco i dettagli:'}
                </p>
                
                <div style="background-color: #fcfcfc; padding: 25px; border-radius: 12px; margin: 25px 0; border: 1px solid #f0f0f0; border-left: 5px solid #11355a;">
                    <p style="margin: 10px 0; font-size: 15px;"><strong style="color: #11355a;">📅 Quando:</strong> ${dataOra}</p>
                    <p style="margin: 10px 0; font-size: 15px;"><strong style="color: #11355a;">📍 Partenza:</strong> ${origin.name}</p>
                    <p style="margin: 10px 0; font-size: 15px;"><strong style="color: #11355a;">🏁 Destinazione:</strong> ${destination.name}</p>
                    <p style="margin: 10px 0; font-size: 15px;"><strong style="color: #11355a;">👥 Passeggeri:</strong> ${payload.passengers}</p>
                    <p style="margin: 10px 0; font-size: 15px;"><strong style="color: #11355a;">👤 Passeggero:</strong> ${payload.passengerName || 'N/D'}</p>
                    <p style="margin: 10px 0; font-size: 15px;"><strong style="color: #11355a;">📞 Telefono:</strong> ${payload.passengerPhone || 'N/D'}</p>
                    ${payload.notes ? `<p style="margin: 15px 0 0 0; padding-top: 15px; border-top: 1px dashed #eee; font-style: italic; color: #666;"><strong style="color: #11355a; font-style: normal;">📝 Note:</strong> ${payload.notes}</p>` : ''}
                </div>

                <p style="color: #666; font-size: 14px; text-align: center; margin-top: 30px; font-weight: bold;">
                    Ti preghiamo di presentarti con massima puntualità.
                </p>
            </div>
            
            <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #edf2f7;">
                <p style="font-size: 12px; color: #718096; margin: 0; font-weight: 500;">
                    ${SMTP_FROM_NAME} • Sistema Prenotazioni Digitale
                </p>
                <p style="font-size: 10px; color: #a0aec0; margin-top: 5px;">
                    Questo è un messaggio automatico, non rispondere direttamente a questa email.
                </p>
            </div>
        </div>
    `;

    try {
        if (SMTP_HOST) {
            console.log(`[MailerService] Invio email a ${driver.email} via SMTP...`);
            await transporter.sendMail({
                from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
                to: driver.email,
                subject: `${subjectPrefix}Corsa per ${dataOra}`,
                html: htmlContent,
            });
            console.log(`[MailerService] ✅ Email inviata con successo a ${driver.email} (SMTP)`);
            return;
        }

        // Se SMTP non è configurato, possiamo usare alternative o lanciare errore
        throw new Error('Configurazione SMTP mancante.');

    } catch (error: any) {
        console.error(`[MailerService] ❌ Errore invio email a ${driver.email}:`, error.message);
        throw error;
    }
}

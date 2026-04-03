import nodemailer from 'nodemailer';
import { it } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';

// ── Configurazione SMTP SiteGround ──────────────────────────────
const SMTP_HOST = process.env.SMTP_HOST || 'mail.consorziotaxi2000.it';
const SMTP_PORT = Number(process.env.SMTP_PORT) || 465;
const SMTP_USER = process.env.SMTP_USER || 'info@consorziotaxi2000.it';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || '"Consorzio Taxi 2000" <info@consorziotaxi2000.it>';

// Log di avvio per diagnostica
console.log(`[MailerService] Configurazione SMTP:`);
console.log(`[MailerService]   Host: ${SMTP_HOST}`);
console.log(`[MailerService]   Port: ${SMTP_PORT}`);
console.log(`[MailerService]   User: ${SMTP_USER}`);
console.log(`[MailerService]   Pass: ${SMTP_PASS ? '********' : 'MANCANTE ⚠️'}`);
console.log(`[MailerService]   From: ${SMTP_FROM}`);

if (!SMTP_PASS) {
    console.warn('[MailerService] ⚠️ ATTENZIONE: SMTP_PASS non configurata! Le email NON verranno inviate.');
}

const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // true per porta 465 (SSL), false per 587 (STARTTLS)
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
    },
    tls: {
        // Necessario per alcuni server SiteGround
        rejectUnauthorized: false,
    },
});

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
 */
export async function sendAssignmentEmail(payload: AssignmentEmailPayload): Promise<void> {
    const { driver, pickupAt, origin, destination, isReminder } = payload;

    if (!driver.email) {
        const msg = `[MailerService] Driver ${driver.name} non ha email. Impossibile inviare notifica.`;
        console.warn(msg);
        throw new Error(msg);
    }

    if (!SMTP_PASS) {
        const msg = '[MailerService] ❌ ERRORE CRITICO: SMTP_PASS non configurata! Impossibile inviare email.';
        console.error(msg);
        throw new Error(msg);
    }

    const dataOra = formatInTimeZone(pickupAt, 'Europe/Rome', "eeee d MMMM 'alle' HH:mm", { locale: it });
    const subjectPrefix = isReminder ? "[PROMEMORIA] " : "[NUOVA CORSA] ";

    const mailOptions = {
        from: SMTP_FROM,
        to: driver.email,
        subject: `${subjectPrefix}Corsa per ${dataOra}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
                <div style="background: linear-gradient(135deg, #11355a 0%, #1a5276 100%); padding: 24px; text-align: center;">
                    <h2 style="color: white; margin: 0; font-size: 20px;">
                        ${isReminder ? '⏰ Promemoria Corsa Imminente' : '🚖 Nuova Corsa Assegnata'}
                    </h2>
                </div>
                
                <div style="padding: 24px;">
                    <p style="color: #333; font-size: 15px;">Gentile <strong>${driver.name}</strong>,</p>
                    <p style="color: #555; font-size: 14px;">
                        ${isReminder ? 'Ti ricordiamo la seguente corsa in programma:' : 'Ti è stata assegnata la seguente corsa:'}
                    </p>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #11355a;">
                        <p style="margin: 8px 0;"><strong>📅 Quando:</strong> ${dataOra}</p>
                        <p style="margin: 8px 0;"><strong>📍 Partenza:</strong> ${origin.name}</p>
                        <p style="margin: 8px 0;"><strong>🏁 Destinazione:</strong> ${destination.name}</p>
                        <p style="margin: 8px 0;"><strong>👥 Passeggeri:</strong> ${payload.passengers}</p>
                        <p style="margin: 8px 0;"><strong>👤 Nome:</strong> ${payload.passengerName || 'N/D'}</p>
                        <p style="margin: 8px 0;"><strong>📞 Tel:</strong> ${payload.passengerPhone || 'N/D'}</p>
                        ${payload.notes ? `<p style="margin: 8px 0;"><strong>📝 Note:</strong> ${payload.notes}</p>` : ''}
                    </div>

                    <p style="color: #666; font-size: 13px;">
                        Ti preghiamo di presentarti con puntualità. Se hai problemi, contatta subito l'amministrazione.
                    </p>
                </div>
                
                <div style="background-color: #f1f1f1; padding: 14px; text-align: center;">
                    <p style="font-size: 11px; color: #999; margin: 0;">
                        Consorzio Taxi 2000 • Questo è un messaggio automatico
                    </p>
                </div>
            </div>
        `,
    };

    try {
        console.log(`[MailerService] Invio email a ${driver.email} ...`);
        const info = await transporter.sendMail(mailOptions);
        console.log(`[MailerService] ✅ Email inviata con successo a ${driver.email} (messageId: ${info.messageId})`);
    } catch (error: any) {
        console.error(`[MailerService] ❌ Errore invio email a ${driver.email}:`, error.message);
        console.error(`[MailerService] Dettaglio errore:`, JSON.stringify({
            code: error.code,
            command: error.command,
            responseCode: error.responseCode,
            response: error.response,
        }));
        throw error;
    }
}

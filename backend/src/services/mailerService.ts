import nodemailer from 'nodemailer';
import { it } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';

// Credenziali Gmail (EMAIL_USER e EMAIL_PASS)
const EMAIL_USER = process.env.EMAIL_USER || 'consorziojubilee25tour@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || ''; // Password per le app di Google

console.log(`[MailerService] Inizializzazione email con Gmail SMTP:`);
console.log(`[MailerService]   Mittente: ${EMAIL_USER}`);
console.log(`[MailerService]   Password App configurata: ${EMAIL_PASS ? 'SI ✅' : 'NO ⚠️'}`);

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
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
 * Invia email di assegnazione corsa al driver tramite Gmail SMTP.
 */
export async function sendAssignmentEmail(payload: AssignmentEmailPayload): Promise<void> {
    const { driver, pickupAt, origin, destination, isReminder } = payload;

    if (!driver.email) {
        const msg = `[MailerService] Driver ${driver.name} non ha email. Impossibile inviare notifica.`;
        console.warn(msg);
        throw new Error(msg);
    }

    if (!EMAIL_USER || !EMAIL_PASS) {
        const msg = '[MailerService] ❌ ERRORE CRITICO: Credenziali Gmail (EMAIL_USER o EMAIL_PASS) non configurate!';
        console.error(msg);
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
            
            <div style="background-color: #f1f1f1; padding: 14px; text-align: center;">
                <p style="font-size: 11px; color: #999; margin: 0;">
                    Consorzio Jubilee 25 Tour • Questo è un messaggio automatico
                </p>
            </div>
        </div>
    `;

    try {
        console.log(`[MailerService] Invio email a ${driver.email} via Gmail SMTP...`);

        const mailOptions = {
            from: `"Consorzio Jubilee 25 Tour" <${EMAIL_USER}>`,
            to: driver.email,
            subject: `${subjectPrefix}Corsa per ${dataOra}`,
            html: htmlContent,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[MailerService] ✅ Email inviata con successo a ${driver.email} (MessageID: ${info.messageId})`);
    } catch (error: any) {
        console.error(`[MailerService] ❌ Errore invio email a ${driver.email}:`, error.message);
        throw new Error(`Errore invio SMTP: ${error.message}`);
    }
}

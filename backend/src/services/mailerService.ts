import nodemailer from 'nodemailer';
import { it } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';

// ── Configurazione Mailjet HTTP API ──────────────────────────────
// Usiamo l'API HTTP di Mailjet (porta 443) perché Render blocca le porte SMTP (465/587)
const MAILJET_API_KEY = process.env.MAILJET_API_KEY || '';
const MAILJET_API_SECRET = process.env.MAILJET_API_SECRET || '';
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || 'info@consorziotaxi2000.it';
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || 'Consorzio Taxi 2000';

console.log(`[MailerService] Configurazione Email (Mailjet HTTP API):`);
console.log(`[MailerService]   API Key: ${MAILJET_API_KEY ? MAILJET_API_KEY.substring(0, 8) + '...' : 'MANCANTE ⚠️'}`);
console.log(`[MailerService]   API Secret: ${MAILJET_API_SECRET ? '********' : 'MANCANTE ⚠️'}`);
console.log(`[MailerService]   From: ${SMTP_FROM_NAME} <${SMTP_FROM_EMAIL}>`);

if (!MAILJET_API_KEY || !MAILJET_API_SECRET) {
    console.warn('[MailerService] ⚠️ ATTENZIONE: Credenziali Mailjet non configurate! Le email NON verranno inviate.');
}

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
 * Invia email di assegnazione corsa al driver tramite Mailjet HTTP API.
 */
export async function sendAssignmentEmail(payload: AssignmentEmailPayload): Promise<void> {
    const { driver, pickupAt, origin, destination, isReminder } = payload;

    if (!driver.email) {
        const msg = `[MailerService] Driver ${driver.name} non ha email. Impossibile inviare notifica.`;
        console.warn(msg);
        throw new Error(msg);
    }

    if (!MAILJET_API_KEY || !MAILJET_API_SECRET) {
        const msg = '[MailerService] ❌ ERRORE CRITICO: Credenziali Mailjet non configurate!';
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
                    Consorzio Taxi 2000 • Questo è un messaggio automatico
                </p>
            </div>
        </div>
    `;

    try {
        console.log(`[MailerService] Invio email a ${driver.email} via Mailjet HTTP API...`);

        const response = await axios.post(
            'https://api.mailjet.com/v3.1/send',
            {
                Messages: [
                    {
                        From: {
                            Email: SMTP_FROM_EMAIL,
                            Name: SMTP_FROM_NAME,
                        },
                        To: [
                            {
                                Email: driver.email,
                                Name: driver.name,
                            },
                        ],
                        Subject: `${subjectPrefix}Corsa per ${dataOra}`,
                        HTMLPart: htmlContent,
                    },
                ],
            },
            {
                auth: {
                    username: MAILJET_API_KEY,
                    password: MAILJET_API_SECRET,
                },
                headers: {
                    'Content-Type': 'application/json',
                },
                timeout: 15000,
            }
        );

        const messageResult = response.data?.Messages?.[0];
        if (messageResult?.Status === 'success') {
            console.log(`[MailerService] ✅ Email inviata con successo a ${driver.email} (MessageID: ${messageResult.To?.[0]?.MessageID})`);
        } else {
            console.warn(`[MailerService] ⚠️ Risposta Mailjet inattesa:`, JSON.stringify(response.data));
        }
    } catch (error: any) {
        const errDetail = error.response?.data || error.message;
        console.error(`[MailerService] ❌ Errore invio email a ${driver.email}:`, JSON.stringify(errDetail));

        if (error.response?.status === 401) {
            console.error('[MailerService] 💡 Credenziali Mailjet (API Key/Secret) non valide!');
        } else if (error.response?.status === 400) {
            console.error('[MailerService] 💡 Richiesta non valida. Verifica che il mittente sia verificato su Mailjet.');
        }

        throw new Error(`Errore Mailjet: ${typeof errDetail === 'string' ? errDetail : JSON.stringify(errDetail)}`);
    }
}


import axios from 'axios';
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

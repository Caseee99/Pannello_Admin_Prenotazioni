import nodemailer from 'nodemailer';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

// Configurazione Mailjet via SMTP (standard per Nodemailer)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'in-v3.mailjet.com',
    port: Number(process.env.SMTP_PORT) || 587,
    auth: {
        user: process.env.SMTP_USER, // API Key
        pass: process.env.SMTP_PASS, // Secret Key
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
        console.warn(`[MailerService] Driver ${driver.name} non ha email. Salto invio.`);
        return;
    }

    const dataOra = format(pickupAt, "eeee d MMMM 'alle' HH:mm", { locale: it });
    const subjectPrefix = isReminder ? "[PROMEMORIA] " : "[NUOVA ASSEGNAZIONE] ";
    
    const mailOptions = {
        from: process.env.SMTP_FROM || '"Napoli Taxi" <noreply@example.com>',
        to: driver.email,
        subject: `${subjectPrefix}Corsa per ${dataOra}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px;">
                <h2 style="color: #333;">${isReminder ? 'Promemoria Corsa Imminente' : 'Nuova Corsa Assegnata'}</h2>
                <p>Gentile <strong>${driver.name}</strong>,</p>
                <p>Ti è stata assegnata la seguente corsa:</p>
                
                <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>📅 Quando:</strong> ${dataOra}</p>
                    <p><strong>📍 Partenza:</strong> ${origin.name}</p>
                    <p><strong>🏁 Destinazione:</strong> ${destination.name}</p>
                    <p><strong>👥 Passeggeri:</strong> ${payload.passengers}</p>
                    <p><strong>👤 Nome:</strong> ${payload.passengerName || 'N/D'}</p>
                    <p><strong>📞 Tel:</strong> ${payload.passengerPhone || 'N/D'}</p>
                    ${payload.notes ? `<p><strong>📝 Note:</strong> ${payload.notes}</p>` : ''}
                </div>

                <p style="color: #666; font-size: 0.9em;">
                    Ti preghiamo di presentarti con puntualità. Se hai problemi, contatta subito l'amministrazione.
                </p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 0.8em; color: #999; text-align: center;">
                    Questo è un messaggio automatico, non rispondere direttamente a questa email.
                </p>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`[MailerService] Email inviata con successo a ${driver.email}`);
    } catch (error) {
        console.error(`[MailerService] Errore invio email a ${driver.email}:`, error);
        throw error;
    }
}

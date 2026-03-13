import nodemailer from 'nodemailer';
import 'dotenv/config';

// Trasportatore SMTP condiviso da tutto il backend
export const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SMTP_HOST || 'mail.consorziotaxi2000.it',
    port: parseInt(process.env.EMAIL_SMTP_PORT || '465', 10),
    secure: true,
    auth: {
        user: process.env.EMAIL_SMTP_USER,
        pass: process.env.EMAIL_SMTP_PASS,
    },
});

// Mittente ufficiale del consorzio
export const FROM_ADDRESS = `"Consorzio Taxi 2000" <${process.env.EMAIL_SMTP_USER}>`;

/**
 * Invia email al tassista quando gli viene assegnata una corsa.
 */
export async function sendAssignmentEmail(booking: {
    id: string;
    pickupAt: Date;
    passengerName: string | null;
    passengerPhone: string | null;
    passengers: number;
    notes: string | null;
    origin?: { name: string } | null;
    destination?: { name: string } | null;
    driver: { name: string; email?: string | null };
    isReminder?: boolean;
}): Promise<void> {
    const { driver, pickupAt, passengerName, passengerPhone, passengers, notes, origin, destination, isReminder } = booking;

    if (!driver.email) {
        console.warn(`[Mailer] Autista "${driver.name}" non ha email — skip notifica assegnazione.`);
        return;
    }

    const dateStr = pickupAt.toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    const timeStr = pickupAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

    const subject = isReminder 
        ? `🔔 PROMEMORIA: Corsa tra 15 min – ${timeStr}`
        : `Corsa assegnata – ${dateStr} ore ${timeStr}`;

    const html = `
<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
  .wrapper { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
  .header { background: #1a3c5b; padding: 28px 32px; }
  .header h1 { color: #ffffff; font-size: 20px; margin: 0; }
  .header p { color: #a8c4e0; font-size: 13px; margin: 4px 0 0; }
  .body { padding: 32px; }
  .greeting { font-size: 16px; color: #222; margin-bottom: 24px; }
  .alert-box { background: #eef6ff; border-left: 4px solid #1a3c5b; border-radius: 4px; padding: 16px 20px; margin-bottom: 24px; }
  .alert-box .date { font-size: 22px; font-weight: bold; color: #1a3c5b; }
  .alert-box .time { font-size: 32px; font-weight: bold; color: #1a3c5b; }
  .section-title { font-size: 12px; font-weight: bold; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin: 20px 0 8px; }
  .detail-row { display: flex; align-items: flex-start; gap: 10px; font-size: 15px; color: #333; margin-bottom: 10px; }
  .detail-row .icon { width: 20px; text-align: center; flex-shrink: 0; }
  .footer { background: #f0f0f0; padding: 18px 32px; font-size: 12px; color: #888; text-align: center; }
  .footer strong { color: #555; }
</style></head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>🚕 Consorzio Taxi 2000</h1>
    <p>Notifica automatica di assegnazione corsa</p>
  </div>
  <div class="body">
    <p class="greeting">Gentile <strong>${driver.name}</strong>,<br>
    Le comunichiamo che Le è stata assegnata la seguente corsa:</p>

    <div class="alert-box">
      <div class="date">${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}</div>
      <div class="time">⏰ ${timeStr}</div>
    </div>

    <div class="section-title">📍 Trasferimento</div>
    <div class="detail-row"><span class="icon">🔴</span><span><strong>Partenza:</strong> ${origin?.name || 'N/D'}</span></div>
    <div class="detail-row"><span class="icon">🟢</span><span><strong>Arrivo:</strong> ${destination?.name || 'N/D'}</span></div>

    <div class="section-title">👤 Passeggero</div>
    <div class="detail-row"><span class="icon">👤</span><span><strong>Nome:</strong> ${passengerName || 'N/D'}</span></div>
    <div class="detail-row"><span class="icon">📞</span><span><strong>Telefono:</strong> ${passengerPhone || 'N/D'}</span></div>
    <div class="detail-row"><span class="icon">👥</span><span><strong>Pax:</strong> ${passengers}</span></div>
    ${notes ? `<div class="detail-row"><span class="icon">📝</span><span><strong>Note:</strong> ${notes}</span></div>` : ''}

    <p style="margin-top:28px; color:#555; font-size:14px;">
      Per qualsiasi comunicazione, risponda a questa email o contatti la centrale operativa.<br>
      Grazie per la collaborazione.
    </p>
  </div>
  <div class="footer">
    <strong>Consorzio Taxi 2000</strong> – info@consorziotaxi2000.it<br>
    Questa è un'email automatica generata dal sistema di gestione prenotazioni.
  </div>
</div>
</body>
</html>`;

    await transporter.sendMail({
        from: FROM_ADDRESS,
        to: driver.email,
        subject,
        html,
        text: `
CONSORZIO TAXI 2000 – Corsa Assegnata

Gentile ${driver.name},

Le comunichiamo che Le è stata assegnata la seguente corsa:

DATA E ORA: ${dateStr} – ${timeStr}
PARTENZA: ${origin?.name || 'N/D'}
ARRIVO: ${destination?.name || 'N/D'}
PASSEGGERO: ${passengerName || 'N/D'} (${passengerPhone || 'N/D'})
PAX: ${passengers}
${notes ? `NOTE: ${notes}` : ''}

Per qualsiasi comunicazione, risponda a questa email.

Consorzio Taxi 2000
info@consorziotaxi2000.it
`.trim(),
    });

    console.log(`[Mailer] Email assegnazione inviata a ${driver.email} per booking ${booking.id}`);
}

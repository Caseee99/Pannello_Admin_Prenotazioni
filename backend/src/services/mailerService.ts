import nodemailer from 'nodemailer';
import 'dotenv/config';

// Trasportatore SMTP condiviso da tutto le backend
// Utilizziamo le impostazioni ufficiali di SiteGround per info@consorziotaxi2000.it
const port = parseInt(process.env.EMAIL_SMTP_PORT || '587', 10);
const isSecure = port === 465;

export const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SMTP_HOST || 'mail.consorziotaxi2000.it',
  port: port,
  secure: isSecure,
  auth: {
    user: process.env.EMAIL_SMTP_USER,
    pass: process.env.EMAIL_SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false,
    minVersion: 'TLSv1.2'
  }
});

// Mittente ufficiale del consorzio
export const FROM_ADDRESS = `"Consorzio Taxi 2000" <${process.env.EMAIL_SMTP_USER}>`;

export interface AssignmentEmailPayload {
  id: string;
  pickupAt: Date;
  passengerName: string | null;
  passengerPhone: string | null;
  passengers: number;
  notes: string | null;
  origin?: { name: string } | null;
  originRaw?: string | null;
  destination?: { name: string } | null;
  destinationRaw?: string | null;
  driver: { name: string; email?: string | null };
  isReminder?: boolean;
}

/**
 * Invia email al tassista quando gli viene assegnata una corsa.
 */
export async function sendAssignmentEmail(booking: AssignmentEmailPayload): Promise<void> {
  const { driver, pickupAt, passengerName, passengerPhone, passengers, notes, origin, originRaw, destination, destinationRaw, isReminder } = booking;

  if (!driver.email) {
    console.warn(`[Mailer] Autista "${driver.name}" non ha email — skip notifica assegnazione.`);
    return;
  }

  const dateStr = pickupAt.toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const timeStr = pickupAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

  const subject = isReminder 
    ? `🔔 PROMEMORIA: Corsa assegnata tra 15 min – ore ${timeStr}`
    : `🚕 NUOVA CORSA ASSEGNATA: ore ${timeStr}`;

  const originName = origin?.name || originRaw || 'N/D';
  const destName = destination?.name || destinationRaw || 'N/D';

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
  .greeting { font-size: 16px; color: #222; margin-bottom: 24px; line-height: 1.5; }
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
    <p>Comunicazione urgente ai Soci - Promemoria Corsa</p>
  </div>
  <div class="body">
    <p class="greeting">Gentile <strong>${driver.name}</strong>,<br><br>
    La preghiamo di prendere nota della seguente corsa a Lei assegnata, la cui partenza è prevista tra 15 minuti:</p>

    <div class="alert-box">
      <div class="date">${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}</div>
      <div class="time">⏰ ore ${timeStr}</div>
    </div>

    <div class="section-title">📍 Dettagli Trasferimento</div>
    <div class="detail-row"><span class="icon">🔴</span><span><strong>Luogo di Partenza:</strong> ${originName}</span></div>
    <div class="detail-row"><span class="icon">🟢</span><span><strong>Destinazione Arrivo:</strong> ${destName}</span></div>

    <div class="section-title">👤 Informazioni Passeggero</div>
    <div class="detail-row"><span class="icon">👤</span><span><strong>Nominativo:</strong> ${passengerName || 'N/D'}</span></div>
    <div class="detail-row"><span class="icon">📞</span><span><strong>Recapito Telefonico:</strong> ${passengerPhone || 'N/D'}</span></div>
    <div class="detail-row"><span class="icon">👥</span><span><strong>Numero Passeggeri (Pax):</strong> ${passengers}</span></div>
    ${notes ? `<div class="detail-row"><span class="icon">📝</span><span><strong>Note Aggiuntive:</strong> ${notes}</span></div>` : ''}

    <p style="margin-top:28px; color:#555; font-size:14px; line-height: 1.5;">
      Restiamo a Sua disposizione per qualsiasi necessità di coordinamento. Le ricordiamo di rispondere a questa comunicazione solo in caso di urgenza contattando la centrale operativa.<br><br>
      Cordiali saluti,<br>
      <strong>Centrale Operativa Consorzio Taxi 2000</strong>
    </p>
  </div>
  <div class="footer">
    <strong>Consorzio Taxi 2000</strong> – info@consorziotaxi2000.it<br>
    Questo messaggio è generato automaticamente dal sistema di gestione operativa.
  </div>
</div>
</body>
</html>`;

  try {
    console.log(`[Mailer] [DEBUG] Preparing to send email. Host: ${process.env.EMAIL_SMTP_HOST || 'mail.consorziotaxi2000.it'}, Port: ${port}, User: ${process.env.EMAIL_SMTP_USER}, From: ${FROM_ADDRESS}`);
    
    await transporter.sendMail({
      from: FROM_ADDRESS,
      to: driver.email,
      subject,
      html,
      text: `
CONSORZIO TAXI 2000 – Promemoria Corsa Assegnata

Gentile ${driver.name},

La preghiamo di prendere nota della seguente corsa a Lei assegnata, la cui partenza è prevista tra 15 minuti:

DATA E ORA: ${dateStr} – ore ${timeStr}
LUOGO DI PARTENZA: ${originName}
DESTINAZIONE ARRIVO: ${destName}

DETTAGLI PASSEGGERO:
NOMINATIVO: ${passengerName || 'N/D'}
RECAPITO TELEFONICO: ${passengerPhone || 'N/D'}
NUMERO PASSEGGERI: ${passengers}
${notes ? `NOTE AGGIUNTIVE: ${notes}` : ''}

Restiamo a Sua disposizione per qualsiasi necessità di coordinamento.

Cordiali saluti,
Centrale Operativa Consorzio Taxi 2000
info@consorziotaxi2000.it
`.trim(),
    });

    console.log(`[Mailer] SUCCESS: Email sent to ${driver.email} for booking ${booking.id}`);
  } catch (err: any) {
    console.error(`[Mailer] FAILED to send email to ${driver.email} (booking ${booking.id}):`, err);
    if (err.code === 'EAUTH') {
      console.error('[Mailer] Authentication failure. Verify EMAIL_SMTP_USER and EMAIL_SMTP_PASS.');
    }
    throw err;
  }
}

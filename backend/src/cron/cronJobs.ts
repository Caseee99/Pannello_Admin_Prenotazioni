import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();

// Configura il trasportatore email usando le credenziali già in .env
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_IMAP_HOST?.replace('imap', 'smtp') || 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

export function initCronJobs() {
    console.log('[CRON] Initializing background jobs...');

    // Esegui ogni minuto
    cron.schedule('* * * * *', async () => {
        try {
            const now = new Date();
            // Calcola il range di tempo tra 14 e 16 minuti da adesso
            const fifteenMinsFromNowStart = new Date(now.getTime() + 14 * 60000);
            const fifteenMinsFromNowEnd = new Date(now.getTime() + 16 * 60000);

            // Trova prenotazioni assegnate che iniziano tra ~15 minuti e non ancora notificate
            const upcomingBookings: any[] = await prisma.booking.findMany({
                where: {
                    status: 'ASSIGNED',
                    driverId: { not: null },
                    driverNotified: false,
                    pickupAt: {
                        gte: fifteenMinsFromNowStart,
                        lte: fifteenMinsFromNowEnd
                    }
                },
                include: {
                    driver: true,
                    origin: true,
                    destination: true
                }
            });

            for (const booking of upcomingBookings) {
                if (!booking.driver || !booking.driver.email) {
                    console.log(`[CRON] Skip booking ${booking.id}: driver has no email`);
                    continue;
                }

                console.log(`[CRON] Sending 15m reminder to driver ${booking.driver.name} for booking ${booking.id}`);

                const mailOptions = {
                    from: `"Consorzio Taxi 2000" <${process.env.EMAIL_SMTP_USER}>`,
                    to: booking.driver.email,
                    subject: `🚕 Promemoria: Corsa tra 15 minuti!`,
                    text: `Ciao ${booking.driver.name},
                    
Ti ricordiamo che tra 15 minuti hai una corsa programmata.
                    
Dettagli:
- Data e Ora: ${booking.pickupAt.toLocaleString('it-IT')}
- Da: ${booking.origin?.name || 'N/A'}
- A: ${booking.destination?.name || 'N/A'}
- Passeggero: ${booking.passengerName || 'N/A'} - ${booking.passengerPhone || 'N/A'}
- Note: ${booking.notes || 'Nessuna nota'}

Buon lavoro!
Il Consorzio`,
                    html: `<p>Ciao <b>${booking.driver.name}</b>,</p>
                    <p>Ti ricordiamo che tra 15 minuti hai una corsa programmata.</p>
                    <h3>Dettagli:</h3>
                    <ul>
                        <li><b>Data e Ora:</b> ${booking.pickupAt.toLocaleString('it-IT')}</li>
                        <li><b>Da:</b> ${booking.origin?.name || 'N/A'}</li>
                        <li><b>A:</b> ${booking.destination?.name || 'N/A'}</li>
                        <li><b>Passeggero:</b> ${booking.passengerName || 'N/A'} - ${booking.passengerPhone || 'N/A'}</li>
                        <li><b>Note:</b> ${booking.notes || 'Nessuna nota'}</li>
                    </ul>
                    <br/>
                    <p>Buon lavoro!<br/><i>Il Consorzio</i></p>`
                };

                await transporter.sendMail(mailOptions);

                // Segna come notificata
                await prisma.booking.update({
                    where: { id: booking.id },
                    data: { driverNotified: true }
                });

                console.log(`[CRON] Reminder sent for booking ${booking.id}`);
            }

        } catch (error) {
            console.error('[CRON] Error checking upcoming bookings:', error);
        }
    });
}

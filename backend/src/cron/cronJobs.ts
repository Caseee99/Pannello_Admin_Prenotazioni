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

import { checkAndNotifyDrivers } from '../services/notificationService';

export function initCronJobs() {
    console.log('[CRON] Initializing background jobs...');

    // Esegui ogni minuto per le notifiche ai driver
    cron.schedule('* * * * *', async () => {
        try {
            await checkAndNotifyDrivers();
        } catch (error) {
            console.error('[CRON] Error in checkAndNotifyDrivers:', error);
        }
    });
}

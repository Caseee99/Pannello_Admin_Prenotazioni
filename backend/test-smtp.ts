import 'dotenv/config';
import { transporter, FROM_ADDRESS } from './src/services/mailerService';

async function main() {
    console.log('Testing SMTP connection with settings:');
    console.log(`- Host: ${process.env.EMAIL_SMTP_HOST}`);
    console.log(`- Port: ${process.env.EMAIL_SMTP_PORT}`);
    console.log(`- User: ${process.env.EMAIL_SMTP_USER}`);

    if (process.env.EMAIL_SMTP_PASS === 'INSERISCI_QUI_LA_PASSWORD_DI_INFO') {
        console.error('\n❌ ERRORE: Hai dimenticato di inserire la vera password nel file .env!');
        console.error('Vai nel file backend/.env e cambia INSERISCI_QUI_LA_PASSWORD_DI_INFO con la password reale.');
        process.exit(1);
    }

    try {
        console.log('\nVerifica connessione SMTP in corso...');
        await transporter.verify();
        console.log('✅ Connessione SMTP riuscita!');

        console.log(`\nProvo a inviare una mail di test a: ${process.env.EMAIL_IMAP_USER}...`);
        
        await transporter.sendMail({
            from: FROM_ADDRESS,
            to: process.env.EMAIL_IMAP_USER, // mandiamo a gmail per testare
            subject: 'Test connessione SiteGround 🚕',
            text: 'Se stai leggendo questo, la connessione SMTP con SiteGround funziona perfettamente!'
        });
        
        console.log('✅ Mail di test inviata con successo! Controlla la casella di posta.');
    } catch (error) {
        console.error('\n❌ Errore durante il test SMTP:');
        console.error(error);
    }
}

main();

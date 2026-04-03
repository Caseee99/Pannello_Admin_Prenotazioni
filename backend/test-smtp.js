// Script di test per verificare la connessione SMTP SiteGround
const nodemailer = require('nodemailer');

const SMTP_HOST = 'mail.consorziotaxi2000.it';
const SMTP_PORT = 587;
const SMTP_USER = 'info@consorziotaxi2000.it';
// INSERISCI QUI LA PASSWORD DELL'EMAIL PER TESTARE
const SMTP_PASS = process.argv[2] || '';

if (!SMTP_PASS) {
    console.error('❌ Uso: node test-smtp.js "LA_TUA_PASSWORD_EMAIL"');
    process.exit(1);
}

console.log('=== Test SMTP SiteGround ===');
console.log(`Host: ${SMTP_HOST}`);
console.log(`Port: ${SMTP_PORT}`);
console.log(`User: ${SMTP_USER}`);
console.log(`Pass: ${'*'.repeat(SMTP_PASS.length)}`);
console.log('');

const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: true, // porta 465 = SSL
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
    },
    tls: {
        rejectUnauthorized: false,
    },
    // Debug SMTP
    debug: true,
    logger: true,
});

console.log('📡 Verifico connessione SMTP...\n');
transporter.verify()
    .then(() => {
        console.log('\n✅ CONNESSIONE SMTP RIUSCITA! Il server accetta le credenziali.');
        console.log('\n📧 Provo ad inviare un\'email di test...\n');
        
        return transporter.sendMail({
            from: `"Consorzio Taxi 2000" <${SMTP_USER}>`,
            to: 'gaetanocasella0@gmail.com', // tua email admin
            subject: '[TEST] Email di test da Pannello Admin',
            html: '<h2>✅ Test riuscito!</h2><p>Se vedi questa email, il sistema SMTP funziona correttamente.</p>',
        });
    })
    .then((info) => {
        console.log('\n✅ EMAIL INVIATA CON SUCCESSO!');
        console.log('MessageId:', info.messageId);
        process.exit(0);
    })
    .catch((err) => {
        console.error('\n❌ ERRORE:', err.message);
        console.error('\nDettagli completi:', JSON.stringify({
            code: err.code,
            command: err.command,
            responseCode: err.responseCode,
            response: err.response,
        }, null, 2));
        
        if (err.code === 'EAUTH') {
            console.error('\n💡 SUGGERIMENTO: La password è sbagliata. Verifica la password della casella email su SiteGround.');
        } else if (err.code === 'ECONNREFUSED') {
            console.error('\n💡 SUGGERIMENTO: Il server rifiuta la connessione. Prova porta 587 con secure: false.');
        } else if (err.code === 'ESOCKET') {
            console.error('\n💡 SUGGERIMENTO: Problema di connessione SSL. Potrebbe servire una configurazione diversa.');
        }
        
        process.exit(1);
    });

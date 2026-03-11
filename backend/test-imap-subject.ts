import "dotenv/config";
import Imap from 'imap';
import { simpleParser } from 'mailparser';

console.log('Connecting to email server...');

const imap = new Imap({
    user: process.env.EMAIL_USER as string,
    password: process.env.EMAIL_PASS as string,
    host: process.env.EMAIL_IMAP_HOST || 'imap.gmail.com',
    port: parseInt(process.env.EMAIL_IMAP_PORT || '993', 10),
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
});

imap.once('ready', () => {
    console.log('Connected!');
    const folder = process.env.EMAIL_FOLDER || 'Lavoro 2';
    imap.openBox(folder, false, (err, box) => {
        if (err) {
            console.error(`Error opening folder "${folder}":`, err);
            imap.end();
            return;
        }

        console.log(`Searching ALL emails in: ${folder}...`);
        imap.search(['ALL'], (err, results) => {
            if (err) {
                console.error('Error searching:', err);
                imap.end();
                return;
            }

            if (!results || results.length === 0) {
                console.log('No emails found.');
                imap.end();
                return;
            }

            const fetch = imap.fetch(results.slice(-1), { bodies: '' }); // Fetch the latest email
            fetch.on('message', (msg) => {
                msg.on('body', (stream) => {
                    simpleParser(stream as any, (err, mail) => {
                        if (err) console.error(err);
                        console.log("\n=================================");
                        console.log("SUBJECT:", mail.subject);
                        console.log("=================================\n");
                    });
                });
            });

            fetch.once('error', (err) => {
                console.error('Fetch error:', err);
                imap.end();
            });

            fetch.once('end', () => {
                console.log('Fetch ended.');
                setTimeout(() => imap.end(), 1000);
            });
        });
    });
});

imap.once('error', (err: Error) => {
    console.error('Connection error:', err);
});

imap.connect();

import "dotenv/config";
import Imap from 'imap';
import { simpleParser } from 'mailparser';

console.log('Connecting to email server...');

const imap = new Imap({
    user: process.env.EMAIL_IMAP_USER as string,
    password: process.env.EMAIL_IMAP_PASS as string,
    host: process.env.EMAIL_IMAP_HOST || 'imap.gmail.com',
    port: parseInt(process.env.EMAIL_IMAP_PORT || '993', 10),
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
});

imap.once('ready', () => {
    const folder = process.env.EMAIL_FOLDER || 'Lavoro';
    console.log(`Opening box: ${folder}`);
    imap.openBox(folder, true, (err, box) => {
        if (err) {
            console.error('Error opening box:', err);
            imap.end();
            return;
        }
        console.log(`Box opened. Total emails: ${box.messages.total}`);
        imap.search(['ALL'], (err, results) => {
            if (err) {
                console.error('Error searching ALL:', err);
            } else {
                console.log(`Search result count: ${results.length}`);
                if (results.length > 0) {
                    const latest = results.slice(-3); // Get last 3
                    const f = imap.fetch(latest, { bodies: '' });
                    f.on('message', (msg, seqno) => {
                        msg.on('body', (stream) => {
                            simpleParser(stream, (err, mail) => {
                                console.log(`[#${seqno}] Date: ${mail.date}, From: ${mail.from?.text}, Subject: ${mail.subject}`);
                            });
                        });
                    });
                    f.once('end', () => {
                        console.log('Done fetching sample.');
                        setTimeout(() => imap.end(), 2000);
                    });
                } else {
                    imap.end();
                }
            }
        });
    });
});

imap.once('error', (err: Error) => {
    console.error('Connection error:', err);
});

imap.once('end', () => {
    console.log('Connection closed.');
});

imap.connect();

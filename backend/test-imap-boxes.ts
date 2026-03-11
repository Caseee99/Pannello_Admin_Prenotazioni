import "dotenv/config";
import Imap from 'imap';

console.log('Connecting to email server to list boxes...');

const imap = new Imap({
    user: process.env.EMAIL_USER as string,
    password: process.env.EMAIL_PASS as string,
    host: process.env.EMAIL_IMAP_HOST || 'imap.gmail.com',
    port: parseInt(process.env.EMAIL_IMAP_PORT || '993', 10),
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
});

imap.once('ready', () => {
    console.log('Connected! Listing boxes...');
    imap.getBoxes((err, boxes) => {
        if (err) {
            console.error('Error getting boxes:', err);
        } else {
            console.log(Object.keys(boxes));
        }
        imap.end();
    });
});

imap.once('error', (err: Error) => {
    console.error('Connection error:', err);
});

imap.connect();

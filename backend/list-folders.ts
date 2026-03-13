import "dotenv/config";
import Imap from 'imap';
import fs from 'fs';

const logFile = 'folder-list.txt';
const logStream = fs.createWriteStream(logFile);

function log(msg: string) {
    console.log(msg);
    logStream.write(msg + '\n');
}

log('Connecting to email server...');
log('User: ' + process.env.EMAIL_IMAP_USER);

const imap = new Imap({
    user: process.env.EMAIL_IMAP_USER as string,
    password: process.env.EMAIL_IMAP_PASS as string,
    host: process.env.EMAIL_IMAP_HOST || 'imap.gmail.com',
    port: parseInt(process.env.EMAIL_IMAP_PORT || '993', 10),
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
});

function listBoxes(boxes: any, prefix = '') {
    for (const key in boxes) {
        log(`${prefix}${key}`);
        if (boxes[key].children) {
            listBoxes(boxes[key].children, `${prefix}${key} / `);
        }
    }
}

imap.once('ready', () => {
    log('Connected! Listing boxes...');
    imap.getBoxes((err, boxes) => {
        if (err) {
            log('Error getting boxes: ' + err);
        } else {
            log('--- BOXES START ---');
            listBoxes(boxes);
            log('--- BOXES END ---');
        }
        imap.end();
    });
});

imap.once('error', (err: Error) => {
    log('Connection error: ' + err);
});

imap.once('end', () => {
    log('Connection closed.');
    logStream.end();
});

imap.connect();

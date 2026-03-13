import "dotenv/config";
import Imap from 'imap';
import fs from 'fs';

const logFile = 'boxes_utf8.txt';
const stream = fs.createWriteStream(logFile, { encoding: 'utf8' });

function log(msg: string) {
    console.log(msg);
    stream.write(msg + '\n');
}

log('Connecting to email server for deep search...');

const imap = new Imap({
    user: process.env.EMAIL_IMAP_USER as string,
    password: process.env.EMAIL_IMAP_PASS as string,
    host: process.env.EMAIL_IMAP_HOST || 'imap.gmail.com',
    port: parseInt(process.env.EMAIL_IMAP_PORT || '993', 10),
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
});

function listBoxesRecursive(boxes: any, prefix = '') {
    for (const key in boxes) {
        const fullPath = prefix ? `${prefix}${boxes[key].delimiter}${key}` : key;
        log(`- ${fullPath}`);
        if (boxes[key].children) {
            listBoxesRecursive(boxes[key].children, fullPath);
        }
    }
}

imap.once('ready', () => {
    log('Connected! Scanning all boxes...');
    imap.getBoxes((err, boxes) => {
        if (err) {
            log('Error getting boxes: ' + err);
        } else {
            log('Found boxes:');
            listBoxesRecursive(boxes);
        }
        imap.end();
    });
});

imap.once('error', (err: Error) => {
    log('Connection error: ' + err);
});

imap.once('end', () => {
    log('Connection closed.');
    stream.end();
});

imap.connect();

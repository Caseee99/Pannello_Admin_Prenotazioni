import Imap from 'imap';
import { simpleParser } from 'mailparser';

export async function fetchUnreadEmails() {
    console.log('[IMAP] Connecting to email server...');

    return new Promise<any[]>((resolve) => {
        const imap = new Imap({
            user: process.env.EMAIL_IMAP_USER as string,
            password: process.env.EMAIL_IMAP_PASS as string,
            host: process.env.EMAIL_IMAP_HOST || 'imap.gmail.com',
            port: parseInt(process.env.EMAIL_IMAP_PORT || '993', 10),
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
            authTimeout: 30000,
            connTimeout: 30000,
        });

        const emails: any[] = [];

        imap.once('ready', () => {
            console.log('[IMAP] Connected successfully!');
            const folder = process.env.EMAIL_FOLDER || 'Lavoro';
            console.log(`[IMAP] Opening folder: ${folder}`);
            imap.openBox(folder, false, (err, box) => {
                if (err) {
                    console.error(`[IMAP] Error opening folder "${folder}":`, err);
                    imap.end();
                    resolve([]);
                    return;
                }

                const fromAddress = process.env.EMAIL_BOOKING_FROM || '';
                console.log(`[IMAP] Searching ALL emails in folder (${fromAddress ? 'expected from: ' + fromAddress : 'any sender'})`);
                // Cerca TUTTE le email nella cartella, anche già lette (forza il riletttura)
                imap.search(['ALL'], (err, results) => {
                    if (err) {
                        console.error('[IMAP] Error searching:', err);
                        imap.end();
                        resolve([]);
                        return;
                    }

                    if (!results || results.length === 0) {
                        console.log('[IMAP] No unread emails found.');
                        imap.end();
                        resolve([]);
                        return;
                    }

                    // Limita a max 10 email più recenti per ciclo
                    const MAX_EMAILS = 10;
                    const limited = results.slice(-MAX_EMAILS);
                    console.log(`[IMAP] Found ${results.length} unread email(s), processing latest ${limited.length}.`);

                    const fetch = imap.fetch(limited, { bodies: '', markSeen: true });
                    let pending = limited.length;

                    console.log(`[IMAP] Fetching and parsing ${limited.length} emails...`);

                    fetch.on('message', (msg, seqno) => {
                        msg.on('body', (stream) => {
                            simpleParser(stream as any, (err, mail) => {
                                if (err) {
                                    console.error(`[IMAP] Error parsing message #${seqno}:`, err);
                                } else {
                                    console.log(`[IMAP] Successfully parsed message #${seqno}: ${mail.subject}`);
                                    emails.push({
                                        uid: null,
                                        subject: mail.subject,
                                        from: mail.from?.text,
                                        date: mail.date,
                                        text: mail.text,
                                        html: mail.html,
                                    });
                                }
                                pending--;
                                if (pending === 0) {
                                    console.log(`[IMAP] Finished parsing all ${emails.length} new emails`);
                                    imap.end();
                                }
                            });
                        });
                    });

                    fetch.once('error', (err) => {
                        console.error('[IMAP] Fetch error:', err);
                        imap.end();
                        resolve(emails);
                    });

                    fetch.once('end', () => {
                        console.log('[IMAP] Fetch event ended, waiting for parsing...');
                        // Safely resolve after a small timeout if pending is still > 0
                        // but ideally the 'ready' handler for the last message resolves it.
                        const checkInterval = setInterval(() => {
                            if (pending <= 0) {
                                clearInterval(checkInterval);
                                resolve(emails);
                            }
                        }, 500);

                        // Hard timeout for safety
                        setTimeout(() => {
                            clearInterval(checkInterval);
                            if (pending > 0) {
                                console.warn(`[IMAP] Force resolving after timeout, ${pending} emails still pending.`);
                            }
                            resolve(emails);
                        }, 30000);
                    });
                });
            });
        });

        imap.once('error', (err: Error) => {
            console.error('[IMAP] Connection error:', err);
            resolve([]);
        });

        imap.once('end', () => {
            console.log('[IMAP] Connection closed.');
        });

        imap.connect();
    });
}

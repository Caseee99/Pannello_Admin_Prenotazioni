import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';

export async function fetchUnreadEmails() {
    console.log('[IMAP] Connecting to email server...');
    const config = {
        imap: {
            user: process.env.EMAIL_USER as string,
            password: process.env.EMAIL_PASS as string,
            host: process.env.EMAIL_IMAP_HOST || 'imap.gmail.com',
            port: parseInt(process.env.EMAIL_IMAP_PORT || '993', 10),
            tls: true,
            authTimeout: 3000,
        }
    };

    try {
        const connection = await imaps.connect(config);
        await connection.openBox('INBOX');

        // Search criteria for UNREAD emails
        const searchCriteria = ['UNREAD'];
        const fetchOptions = {
            bodies: ['HEADER', 'TEXT', ''],
            markSeen: true // Marks as Read while fetching so we don't process it again
        };

        const results = await connection.search(searchCriteria, fetchOptions);
        const emails = [];

        for (const res of results) {
            const all = res.parts.find(p => p.which === '');
            const id = res.attributes.uid;
            const body = all?.body;
            if (body) {
                const mail = await simpleParser(body);
                emails.push({
                    uid: id,
                    subject: mail.subject,
                    from: mail.from?.text,
                    date: mail.date,
                    text: mail.text,
                    html: mail.html
                });
            }
        }

        connection.end();
        console.log(`[IMAP] Parsed ${emails.length} new emails`);
        return emails;
    } catch (error) {
        console.error('[IMAP] Error fetching emails:', error);
        return [];
    }
}

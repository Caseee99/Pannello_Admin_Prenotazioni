import "dotenv/config";
import * as tls from 'tls';

console.log('Testing raw TLS connection to imap.gmail.com:993...');
console.log('User:', process.env.EMAIL_USER);
console.log('Pass length:', process.env.EMAIL_PASS?.length);

const socket = tls.connect({
    host: 'imap.gmail.com',
    port: 993,
    rejectUnauthorized: false,
}, () => {
    console.log('TLS connected! Server says:');
});

socket.on('data', (data: Buffer) => {
    console.log('Server:', data.toString().trim());
    // After greeting, try to login
    if (data.toString().includes('OK')) {
        const user = process.env.EMAIL_USER;
        const pass = process.env.EMAIL_PASS;
        console.log(`Sending LOGIN command...`);
        socket.write(`a1 LOGIN ${user} ${pass}\r\n`);
    }
    if (data.toString().includes('a1 OK')) {
        console.log('LOGIN SUCCESS!');
        socket.write('a2 LIST "" "*"\r\n');
    }
    if (data.toString().includes('a1 NO') || data.toString().includes('a1 BAD')) {
        console.log('LOGIN FAILED!');
        socket.end();
        process.exit(1);
    }
    if (data.toString().includes('a2 OK')) {
        console.log('LIST done, closing.');
        socket.end();
        process.exit(0);
    }
});

socket.on('error', (err: Error) => {
    console.error('Connection error:', err.message);
    process.exit(1);
});

socket.on('timeout', () => {
    console.error('Connection timed out!');
    socket.end();
    process.exit(1);
});

socket.setTimeout(15000);

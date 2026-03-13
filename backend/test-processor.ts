import "dotenv/config";
import { processNewEmails } from './src/services/emailProcessor';

console.log('Starting manual execution of processNewEmails...');

async function run() {
    try {
        await processNewEmails();
        console.log('processNewEmails completed.');
    } catch (error) {
        console.error('Error in processNewEmails:', error);
    }
}

run();

import buildServer from './app';
import cron from 'node-cron';
import { processNewEmails } from './services/emailProcessor';

const start = async () => {
    try {
        const server = await buildServer();
        const port = parseInt(process.env.PORT || '3000', 10);

        await server.listen({ port, host: '0.0.0.0' });
        console.log(`Server is listening on port ${port}`);

        // Avvio Polling Email usando cron (ogni 5 minuti)
        console.log("Scheduling Email Parser Cron Job (Every 5 minutes)");
        cron.schedule('*/5 * * * *', () => {
            processNewEmails();
        });

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

start();

import "dotenv/config";
import buildServer from './app';
import { initCronJobs } from './services/cronService';

const start = async () => {
    try {
        const server = await buildServer();
        const port = parseInt(process.env.PORT || '3000', 10);

        await server.listen({ port, host: '0.0.0.0' });
        console.log(`Server is listening on port ${port}`);

        // Avvia i job cron (notifiche del mattino alle 08:00)
        initCronJobs();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

start();


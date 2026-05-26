import "dotenv/config";
import buildServer from './app';
const start = async () => {
    try {
        const server = await buildServer();
        const port = parseInt(process.env.PORT || '3000', 10);

        await server.listen({ port, host: '0.0.0.0' });
        console.log(`Server is listening on port ${port}`);

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

start();

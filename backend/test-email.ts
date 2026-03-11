import "dotenv/config";
import { processNewEmails } from "./src/services/emailProcessor";

async function run() {
    try {
        await processNewEmails();
        console.log("Completato");
        process.exit(0);
    } catch (e) {
        console.error("Errore script:", e);
        process.exit(1);
    }
}
run();

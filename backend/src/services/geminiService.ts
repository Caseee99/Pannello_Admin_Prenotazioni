import { GoogleGenAI, Type } from "@google/genai";
import "dotenv/config";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const bookingSchema = {
    type: Type.ARRAY,
    description: "Una lista di trasferimenti (andate o ritorni) estratti dall'email.",
    items: {
        type: Type.OBJECT,
        properties: {
            actionType: {
                type: Type.STRING,
                description: "Tipo di azione: 'CANCEL' se l'email chiede la CANCELLAZIONE o ANNULLAMENTO di una prenotazione esistente, 'UPDATE' se è una MODIFICA, altrimenti 'CREATE' per una nuova prenotazione.",
                nullable: false,
            },
            externalRef: {
                type: Type.STRING,
                description: "Il codice di prenotazione (PNR, Numero Prenotazione, Reference ID) estratto dall'oggetto o dal corpo dell'email (es. 0000084526). Restituisci null se manca.",
                nullable: true,
            },
            pickupDateTime: {
                type: Type.STRING,
                description: "Data e ora del prelievo in formato ISO8601 string, null se manca.",
                nullable: true,
            },
            origin: {
                type: Type.STRING,
                description: "Punto di partenza (struttura, aeroporto, porto, stazione, o indirizzo specifico). Restituisci null se manca.",
                nullable: true,
            },
            destination: {
                type: Type.STRING,
                description: "Punto di arrivo. Restituisci null se manca.",
                nullable: true,
            },
            passengersCount: {
                type: Type.INTEGER,
                description: "Numero totale di passeggeri (adulti + bambini). Restituisci null se manca.",
                nullable: true,
            },
            passengerName: {
                type: Type.STRING,
                description: "Nome completo o parziale o cognome del referente principale. Restituisci null se manca.",
                nullable: true,
            },
            passengerPhone: {
                type: Type.STRING,
                description: "Numero di cellulare con prefisso se presente. Restituisci null se manca.",
                nullable: true,
            },
            notes: {
                type: Type.STRING,
                description: "Note aggiuntive estratte dall'email come treno in arrivo, richieste particolari. Restituisci null se manca.",
                nullable: true,
            },
        },
        required: ["actionType", "pickupDateTime", "origin", "destination", "passengersCount", "passengerName", "passengerPhone", "notes"],
    },
};

export async function parseEmailContentWithGemini(emailContent: string) {
    console.log('[Gemini] Parsing email content...');

    const prompt = `
Sei un assistente specializzato per un'azienda di noleggio con conducente (NCC) / Taxi.
Il tuo obiettivo è leggere l'email incollata sotto (mandata da un'agenzia di viaggi) ed estrarre i dati esatti delle prenotazioni.
Spesso una singola email contiene PIÙ trasferimenti (es. Andata e Ritorno separati per orari e giorni diversi). Devi estrarre TUTTI i trasferimenti in modo indipendente, creando un array JSON di oggetti.

REGOLE per il campo actionType:
- Se l'email parla di ANNULLAMENTO, CANCELLAZIONE, DISDETTA, imposta actionType = 'CANCEL'.
- Se l'email dice MODIFICA, VARIAZIONE, CAMBIO di una prenotazione esistente, imposta actionType = 'UPDATE'.
- Per tutti gli altri casi (nuova prenotazione), imposta actionType = 'CREATE'.

Email:
"""
${emailContent}
"""
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: bookingSchema,
                temperature: 0.1,
            }
        });

        if (response.text) {
            return JSON.parse(response.text);
        }
        throw new Error("Empty response from Gemini");
    } catch (error) {
        console.error('[Gemini] Error parsing content:', error);
        throw error;
    }
}

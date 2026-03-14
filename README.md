# Pannello Admin Prenotazioni - Napoli Taxi

Sistema di gestione prenotazioni taxi per una cooperativa a Napoli. Il sistema automatizza l'importazione di prenotazioni da email, la gestione degli autisti e dei pagamenti.

## Struttura del Progetto

Il progetto è un monorepo TypeScript composto da:

- `frontend/`: Applicazione React + Vite + TailwindCSS per l'interfaccia amministrativa.
- `backend/`: API Fastify + Prisma + PostgreSQL per la logica di business e il parsing delle email.

## Setup Rapido

1. **Prerequisiti**: Node.js v20+, PostgreSQL.
2. **Installazione**:
   ```bash
   npm install
   ```
3. **Configurazione**:
   Copia `.env.example` in `.env` e compila le variabili necessarie (DATABASE_URL, GEMINI_API_KEY, EMAIL_PASS, etc.).
4. **Database**:
   ```bash
   cd backend
   npx prisma migrate dev
   npx prisma db seed
   ```
5. **Sviluppo**:
   Dalla root del progetto:
   ```bash
   npm run dev
   ```

## Deploy

### Frontend (Vercel)
Il frontend è già configurato per Vercel via `frontend/vercel.json`.
- Collega il repository a Vercel.
- Imposta la `Root Directory` su `frontend`.
- Aggiungi la variabile d'ambiente `VITE_API_URL` puntando all'URL del backend.

### Backend
Può essere deployato su Railway, Render o Fly.io.
- Punti di ingresso: `backend/src/server.ts`.
- Assicurati di eseguire `npx prisma migrate deploy` durante il processo di build/release.
- Imposta tutte le variabili d'ambiente presenti nel file `.env`.

## Funzionalità Principali
- **E-mail Parser**: Polling IMAP automatico (ogni 5 min) e parsing con Google Gemini AI.
- **Gestione Prenotazioni**: Calendario interattivo e lista tabellare.
- **Assegnazione Autisti**: Generazione automatica di messaggi WhatsApp pre-compilati.
- **Report e Ricevute**: Generazione automatica di report mensili per autisti e agenzia.

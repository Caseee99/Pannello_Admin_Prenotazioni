ISTRUZIONI PER L'AGENTE
Leggi l'intero documento prima di eseguire qualsiasi azione. Usa Planning Mode per ogni task principale. Produci sempre un Plan Artifact prima di scrivere codice.

Regole operative — carica in Antigravity Rules
•	TypeScript ovunque — nessun any implicito
•	Validazione input con Zod su ogni endpoint
•	Ogni modifica al DB richiede una migration versionata
•	Nessun valore hardcodato: tariffe, destinazioni e configurazioni vivono nel DB o in .env
•	Test unitari obbligatori per: parser email, calcolo pagamenti, logica assegnazione
•	Se un requisito e' ambiguo, fermati e chiedi — non assumere mai
•	Dopo ogni task: mostra Artifact con file creati, decisioni prese, domande aperte

Cosa NON costruire in questo brief
IMPORTANTE — Questo brief copre SOLO il pannello admin. Non costruire app mobile, notifiche push agli autisti, o portale agenzia. I soci continuano a ricevere le corse via WhatsApp/telefono come oggi.


1. Contesto del Progetto
1.1 Situazione attuale
Una cooperativa taxi a Napoli con 100+ soci riceve prenotazioni via email da un'agenzia di viaggi partner. Oggi l'admin gestisce tutto manualmente: legge le email, inserisce i dati in un Google Sheet, chiama o scrive su WhatsApp agli autisti per assegnare le corse, calcola i pagamenti a mano a fine mese.
Volume: 100+ prenotazioni/mese. A questo volume, l'inserimento manuale rappresenta circa 15-20 ore di lavoro amministrativo mensile.

1.2 Cosa rimane invariato dopo questo progetto
•	I soci NON usano nessuna app — ricevono le corse via WhatsApp o telefono esattamente come oggi
•	L'agenzia NON ha accesso al sistema — continua a mandare email
•	L'admin e' l'unico utente del pannello web

1.3 Cosa cambia
•	Le email vengono importate automaticamente — niente piu' inserimento manuale nel Google Sheet
•	L'admin ha un calendario visivo delle prenotazioni invece di un foglio piatto
•	L'assegnazione dell'autista e' tracciata nel sistema (non piu' solo nella testa dell'admin)
•	I pagamenti ai soci vengono calcolati automaticamente a fine mese
•	I report per l'agenzia si generano in un click

1.4 Rotte principali gestite
ID	Partenza	Destinazione
R1	Stazione Centrale Napoli	Molo Beverello
R2	Stazione Centrale Napoli	Calata Porta di Massa
R3	Aeroporto Napoli (Capodichino)	Molo Beverello
R4	Aeroporto Napoli (Capodichino)	Calata Porta di Massa
R*-INV	Inverso di ogni rotta sopra	—
CUSTOM	Qualsiasi	Qualsiasi — inserimento manuale


2. Architettura Tecnica
2.1 Un solo prodotto da costruire
A differenza di scenari piu' complessi, qui si costruisce UN SOLO prodotto: un'applicazione web full-stack con backend API e frontend React. Nessuna app mobile. Nessun sistema di notifiche push.

Layer	Tecnologia consigliata	Scopo
Backend API	Node.js + TypeScript + Fastify + Prisma ORM	Logica business, accesso DB, parser email
Database	PostgreSQL	Persistenza dati
Frontend Admin	React + TypeScript + TailwindCSS + shadcn/ui	Unica interfaccia utente
Parser Email	Servizio integrato nel backend + Gemini API	Estrazione dati dalle email agenzia
Hosting	Railway / Render / Fly.io (suggerito)	Deploy semplice, ~10-15 EUR/mese
Auth	JWT + bcrypt — un solo account admin	Nessun sistema multi-utente necessario

NOTA — Se preferisci uno stack diverso, crea un Plan Artifact con confronto e chiedi conferma prima di procedere.

2.2 Schema database — entita' principali
L'agente deve generare lo schema Prisma completo come primo deliverable del Task 2.

Entita'	Campi chiave	Note
Booking	id, pickupAt, originId, destinationId, passengers, passengerName, passengerPhone, notes, status, driverId, fareId, source, createdAt	Entita' centrale del sistema
Driver	id, name, phone, email, active, createdAt	Anagrafica soci — nessun accesso al sistema
Location	id, name, type (HUB|PORT|AIRPORT|CUSTOM), active	Origini e destinazioni
Fare	id, originId, destinationId, amount, currency, active	Tariffe per tratta
Availability	id, driverId, weekStart, mon/tue/wed/thu/fri/sat/sun (bool)	Flag disponibilita' settimanale
EmailImport	id, rawContent, parsedJson, status, bookingId, createdAt	Traccia ogni email ricevuta
Payment	id, driverId, bookingId, amount, month, year, paid, paidAt	Quota maturata per corsa

2.3 Stati di una prenotazione
Stato	Significato	Chi agisce
DRAFT	Importata da email, in attesa revisione	Sistema (automatico)
CONFIRMED	Approvata dall'admin, autista da assegnare	Admin
ASSIGNED	Autista designato nel sistema	Admin
COMPLETED	Corsa eseguita — admin la marca completata	Admin (manuale)
CANCELLED	Annullata	Admin
NOTA SEMPLIFICAZIONE — Non ci sono stati IN_PROGRESS o ACCEPTED perche' gli autisti non usano l'app. L'admin marca manualmente la corsa come completata dopo aver ricevuto conferma dall'autista (via WhatsApp/telefono).


3. Funzionalita' del Pannello Admin
3.1 Dashboard — schermata home
•	Contatori in evidenza: corse oggi (totali / assegnate / non assegnate / completate)
•	Lista prenotazioni DRAFT da revisionare — priorita' massima, in cima alla pagina
•	Alert visivo: corse nelle prossime 3 ore senza autista assegnato
•	Mini-calendario della settimana con densita' corse per giorno

3.2 Gestione prenotazioni
Vista lista / calendario:
•	Switchabile tra lista tabellare e vista calendario mensile/settimanale
•	Filtri: per stato, per autista, per tratta, per data
•	Ogni riga/evento mostra: orario, tratta, autista assegnato (o 'Non assegnato' in rosso), stato
•	Click su una prenotazione: pannello laterale con tutti i dettagli e le azioni disponibili

Schermata revisione email (stato DRAFT):
•	Layout a due colonne: sinistra email originale renderizzata, destra form pre-compilato
•	Campi estratti con bassa confidence evidenziati in giallo
•	Campi critici mancanti evidenziati in rosso con richiesta di completamento
•	Bottone 'Conferma prenotazione' -> stato CONFIRMED
•	Bottone 'Scarta' con nota obbligatoria

Assegnazione autista:
•	Dropdown autisti filtrato automaticamente: solo chi ha flag disponibilita' attivo per quel giorno E nessuna corsa sovrapposta nell'orario
•	Ordinamento suggerito: meno corse assegnate nel giorno
•	Dopo assegnazione: il sistema mostra un messaggio WhatsApp pre-compilato da copiare e inviare all'autista

Il messaggio WhatsApp pre-compilato e' la funzionalita' chiave che sostituisce l'app mobile. Esempio: 'Ciao Mario, hai una corsa: 15/03 ore 09:30 | Stazione Centrale -> Molo Beverello | 3 passeggeri | Tel: +39 333...'

Completamento corsa:
•	L'admin marca manualmente una corsa come COMPLETED dopo conferma dell'autista
•	Il sistema registra automaticamente il pagamento dovuto all'autista (tariffa della tratta)

3.3 Gestione autisti
•	Lista soci con: nome, telefono, stato attivo/inattivo
•	Per ogni autista: flag disponibilita' settimanale (7 toggle), corse del mese, importo maturato
•	Aggiunta / modifica / disattivazione autista
•	Vista dettaglio autista: storico corse complete con importi

3.4 Pagamenti e report
•	Selezione mese + anno -> generazione automatica report
•	Report soci: tabella con nome, corse completate, importo totale, stato (da pagare / pagato)
•	Bottone 'Segna come pagato' per ogni autista
•	Report agenzia: tutte le corse del mese con totale fatturabile
•	Export PDF e Excel di entrambi i report

3.5 Configurazione
•	Tariffe: tabella per tratta con CRUD completo
•	Destinazioni: aggiunta, modifica, attivazione/disattivazione
•	Parser email: indirizzo IMAP, credenziali, frequenza polling (default: ogni 5 minuti)


4. Parser Email — Specifiche
Componente piu' critico. Deve essere robusto: nessuna email deve essere persa silenziosamente.

4.1 Flusso tecnico
1.	Il backend effettua polling IMAP ogni 5 minuti sulla casella dedicata
2.	Per ogni email nuova: salva il contenuto grezzo in EmailImport con status PROCESSING
3.	Chiama Gemini API con prompt strutturato per estrarre i campi in JSON
4.	Valida il JSON estratto contro lo schema atteso
5.	Se validazione OK: crea Booking in stato DRAFT, aggiorna EmailImport a PENDING_REVIEW
6.	Se validazione KO o campi critici mancanti: aggiorna EmailImport a NEEDS_REVIEW con flag di errore
7.	In entrambi i casi: mostra notifica nella dashboard admin al prossimo accesso

4.2 Prompt LLM per il parsing
Estrai i seguenti campi dall'email sottostante. Rispondi SOLO con JSON valido, nessun testo aggiuntivo.
Schema richiesto:
{
  "pickupDateTime": "ISO8601 o null",
  "origin": "stringa descrittiva o null",
  "destination": "stringa descrittiva o null",
  "passengersCount": "numero intero o null",
  "passengerName": "stringa o null",
  "passengerPhone": "stringa o null",
  "notes": "stringa o null"
}
Se un campo non e' presente o non e' chiaro, usa null.

4.3 Gestione errori
•	LLM non risponde o JSON non valido: EmailImport status ERROR — email originale sempre salvata
•	Campi critici null (pickupDateTime, origin, destination): status NEEDS_REVIEW — evidenziati in rosso
•	Nessuna prenotazione viene mai confermata automaticamente — sempre revisione admin
•	Retry automatico in caso di errore LLM: massimo 3 tentativi con backoff esponenziale


5. API Endpoints
L'agente deve progettare l'API REST completa. Di seguito i gruppi minimi richiesti.

Gruppo	Endpoint principali	Note
Auth	POST /auth/login, POST /auth/logout, POST /auth/refresh	Un solo utente admin
Bookings	GET /bookings, POST /bookings, GET /bookings/:id, PATCH /bookings/:id, DELETE /bookings/:id	PATCH gestisce cambio stato e assegnazione
Drivers	GET /drivers, POST /drivers, GET /drivers/:id, PATCH /drivers/:id, PATCH /drivers/:id/availability	Anagrafica soci
Locations	GET /locations, POST /locations, PATCH /locations/:id	Destinazioni
Fares	GET /fares, POST /fares, PATCH /fares/:id	Tariffe per tratta
Email Imports	GET /email-imports, GET /email-imports/:id, PATCH /email-imports/:id/confirm, PATCH /email-imports/:id/discard	Revisione email
Reports	GET /reports/monthly, GET /reports/drivers/:id/monthly	Query params: month, year
Payments	GET /payments, PATCH /payments/:id/mark-paid	Gestione pagamenti soci


6. Sistema Messaggi WhatsApp
Questa e' la funzionalita' che sostituisce l'app mobile per i soci. E' semplice ma ad alto impatto operativo.

Dopo ogni assegnazione autista, il sistema genera automaticamente un messaggio WhatsApp pre-compilato che l'admin puo' copiare in un click e inviare al socio.

Template messaggio di assegnazione
Ciao [NOME_AUTISTA],

Hai una nuova corsa assegnata:
📅 [DATA] alle [ORA]
📍 Da: [PARTENZA]
📍 A: [DESTINAZIONE]
👥 Passeggeri: [N]
📞 Contatto: [NOME_PASSEGGERO] — [TELEFONO]
[NOTE se presenti]

Conferma ricezione. Grazie!

Template messaggio di annullamento
Ciao [NOME_AUTISTA],
La corsa del [DATA] alle [ORA] ([PARTENZA] -> [DESTINAZIONE]) e' stata ANNULLATA.

Il bottone 'Copia messaggio' usa l'API Clipboard del browser. Su mobile apre direttamente WhatsApp con il messaggio pre-compilato tramite link wa.me.


7. Task List per l'Agente
Esegui i task nell'ordine indicato. Ogni task deve produrre un Artifact con deliverable, decisioni prese e domande aperte.

FASE 1 — Fondamenta (priorita' massima)
Task	Nome	Descrizione	Deliverable	Modalita'
T1	Setup progetto	Inizializza il repository con struttura monorepo: /backend e /frontend. Configura TypeScript, ESLint, Prettier, variabili d'ambiente, Docker Compose per sviluppo locale con PostgreSQL.	Struttura cartelle, package.json, tsconfig, docker-compose.yml, .env.example	Planning
T2	Schema DB	Progetta e implementa lo schema Prisma completo basato sulla sezione 2.2. Crea migration iniziale. Aggiungi seed con dati realistici: 5 autisti, 8 location, tariffe per tutte le tratte, 10 prenotazioni di test in vari stati.	schema.prisma, migration, seed.ts	Planning
T3	Backend API	Implementa tutti gli endpoint REST (sezione 5). Autenticazione JWT con refresh token. Validazione input Zod. Middleware di error handling. Test unitari per business logic.	routes/, controllers/, middleware/, tests/	Planning
T4	Parser Email	Servizio IMAP polling integrato nel backend. Integrazione Gemini API con prompt sezione 4.2. Gestione errori robusta con retry. Salvataggio sempre dell'email originale.	email-parser/, prompt.ts, retry logic	Planning
T5	Frontend Admin	Implementa tutte le schermate del pannello (sezione 3): dashboard, lista prenotazioni, revisione email, assegnazione autista con messaggio WhatsApp, gestione soci, report.	React pages, components, API hooks, routing	Planning
T6	Integrazione	Test end-to-end del flusso completo. Fix bug. Documentazione .env e istruzioni deploy.	Test E2E, README, .env.example documentato	Planning

FASE 2 — Completamento operativo
Task	Nome	Descrizione	Note
T7	Report e pagamenti	Export PDF e Excel dei report mensili. Logica calcolo pagamenti automatica. Bottone 'Segna pagato'.	Usa pdfmake o pdf-lib per il PDF
T8	Disponibilita' autisti	Implementa il flag disponibilita' settimanale e la sua integrazione nel filtro di assegnazione.	Richiede T2 e T5 completati
T9	Refinement UX	Ottimizzazione interfaccia basata su feedback reale dopo prime settimane di utilizzo.	Da pianificare con l'utente

FASE 3 — Espansioni future (non in scope ora)
Le seguenti funzionalita' sono escluse da questo brief. Valutare in futuro se il volume o le esigenze crescono.

•	App mobile per gli autisti (da costruire solo se i soci chiedono piu' struttura)
•	Portale web per l'agenzia di viaggi (visibilita' stato corse in tempo reale)
•	Notifiche push automatiche
•	Multi-agenzia (supporto a piu' fonti di prenotazione)


8. Domande Aperte — L'Agente DEVE Chiedere
OBBLIGATORIO — Raccogliere queste informazioni prima di iniziare il Task 1. Non usare valori di default senza conferma esplicita dell'utente.

#	Domanda	Impatto	Priorita'
1	Qual e' l'indirizzo email dedicato per le prenotazioni? Che provider (Gmail, Outlook, altro)?	Configurazione IMAP	CRITICA
2	Puoi condividere 2-3 email di esempio dell'agenzia (anche anonimizzate)?	Qualita' del prompt parser	CRITICA
3	Quali sono le tariffe per ciascuna tratta? Anche provvisorie vanno bene.	Modulo pagamenti	ALTA
4	Hai gia' un dominio o preferisci che il sistema suggerisca una soluzione di hosting?	Setup deploy	ALTA
5	Il Google Sheet attuale ha colonne specifiche? Vuoi mantenere compatibilita' o migrare tutto nel nuovo sistema?	Strategia di migrazione dati	MEDIA
6	L'agenzia deve ricevere una email di conferma automatica quando la corsa e' confermata nel sistema?	Modulo notifiche outbound	MEDIA
7	Ci sono tariffe differenziate (orario notturno, festivi, bagagli extra)?	Struttura tabella tariffe	BASSA


9. Requisiti Non Funzionali
9.1 Sicurezza
•	Un solo account admin — nessun sistema di registrazione pubblica
•	JWT con scadenza 15 minuti + refresh token 7 giorni
•	Password hashata con bcrypt (salt rounds >= 12)
•	HTTPS obbligatorio in produzione
•	Nessun dato sensibile nei log (telefoni, nomi passeggeri)

9.2 Performance e affidabilita'
•	Il pannello deve caricarsi entro 3 secondi
•	Il parser email non deve perdere email: ogni email ricevuta viene sempre salvata in EmailImport prima di qualsiasi elaborazione
•	In caso di errore LLM: retry automatico (max 3 volte), poi stato NEEDS_REVIEW con notifica admin
•	Backup database automatico giornaliero

9.3 Usabilita'
•	Interfaccia ottimizzata per desktop (l'admin lavora da PC)
•	Responsive fino a tablet — non prioritario su smartphone
•	Azioni critiche (conferma prenotazione, assegnazione) accessibili in massimo 2 click dalla dashboard

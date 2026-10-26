import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';

export interface ExportBooking {
    pickupAt: Date;
    passengerName: string | null;
    passengerPhone: string | null;
    agency: string | null;
    price: number | null;
    origin?: { name: string } | null;
    destination?: { name: string } | null;
    originRaw: string | null;
    destinationRaw: string | null;
    passengers: number;
    status: string;
    driver?: { name: string } | null;
}

const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('it-IT', {
        timeZone: 'Europe/Rome',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(new Date(date)).replace(/\//g, '/').replace(',', '');
};

const formatShortDate = (date: Date) => {
    return new Intl.DateTimeFormat('it-IT', {
        timeZone: 'Europe/Rome',
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(new Date(date)).replace(/\//g, '/').replace(',', '');
};

export const generateExcel = (bookings: ExportBooking[]): Buffer => {
    const data = bookings.map(b => ({
        'Data': formatDate(b.pickupAt),
        'Agenzia': b.agency || '---',
        'Passeggero': b.passengerName || '---',
        'Telefono': b.passengerPhone || '---',
        'Pax': b.passengers,
        'Partenza': b.origin?.name || b.originRaw || '---',
        'Arrivo': b.destination?.name || b.destinationRaw || '---',
        'Prezzo': b.price ? `€${Number(b.price).toFixed(2)}` : '---',
        'Autista': b.driver?.name || '---',
        'Stato': b.status
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Prenotazioni');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

export const generatePDF = (bookings: ExportBooking[]): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        // Calcola totali per il riepilogo
        const totalBookings = bookings.length;
        const totalPassengers = bookings.reduce((sum, b) => sum + (b.passengers || 1), 0);
        const totalRevenue = bookings.reduce((sum, b) => sum + (b.price || 0), 0);

        // Raggruppa per data per facilitare la lettura
        const byDate: Record<string, ExportBooking[]> = {};
        bookings.forEach(b => {
            const dateKey = new Intl.DateTimeFormat('it-IT', {
                timeZone: 'Europe/Rome',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            }).format(new Date(b.pickupAt));
            if (!byDate[dateKey]) byDate[dateKey] = [];
            byDate[dateKey].push(b);
        });

        const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err: Error) => reject(err));

        const PAGE_W = 841.89;  // A4 landscape width in points
        const PAGE_H = 595.28;
        const MARGIN = 40;
        const CONTENT_W = PAGE_W - MARGIN * 2;

        // ── Barra intestazione colorata ──────────────────────────────────
        doc.rect(0, 0, PAGE_W, 60).fill('#11355a');
        doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold')
            .text('RIEPILOGO PRENOTAZIONI', MARGIN, 18, { align: 'center', width: CONTENT_W });
        doc.fontSize(9).font('Helvetica')
            .text(`Generato il ${formatDate(new Date())}`, MARGIN, 42, { align: 'center', width: CONTENT_W });
        doc.fillColor('#000000');

        // ── Box riepilogo ────────────────────────────────────────────────
        const summaryTop = 75;
        const boxW = (CONTENT_W - 20) / 3;

        const drawSummaryBox = (x: number, label: string, value: string, color: string) => {
            doc.rect(x, summaryTop, boxW, 46).fillAndStroke(color, color);
            doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18)
                .text(value, x, summaryTop + 6, { width: boxW, align: 'center' });
            doc.font('Helvetica').fontSize(8)
                .text(label, x, summaryTop + 28, { width: boxW, align: 'center' });
            doc.fillColor('#000000');
        };

        // Solo 2 box: niente prezzi (info riservata admin)
        const boxW2 = (CONTENT_W - 10) / 2;
        doc.rect(MARGIN,            summaryTop, boxW2, 46).fillAndStroke('#2563eb', '#2563eb');
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18)
            .text(`${totalBookings}`, MARGIN, summaryTop + 6, { width: boxW2, align: 'center' });
        doc.font('Helvetica').fontSize(8)
            .text('PRENOTAZIONI TOTALI', MARGIN, summaryTop + 28, { width: boxW2, align: 'center' });
        doc.fillColor('#000000');

        doc.rect(MARGIN + boxW2 + 10, summaryTop, boxW2, 46).fillAndStroke('#16a34a', '#16a34a');
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18)
            .text(`${totalPassengers} pax`, MARGIN + boxW2 + 10, summaryTop + 6, { width: boxW2, align: 'center' });
        doc.font('Helvetica').fontSize(8)
            .text('PERSONE TOTALI', MARGIN + boxW2 + 10, summaryTop + 28, { width: boxW2, align: 'center' });
        doc.fillColor('#000000');

        // ── Definizione colonne tabella ───────────────────────────────────
        const tableStartY = summaryTop + 60;
        const COL = {
            widths: [90, 75, 115, 72, 32, 150, 150, 74],
            headers: ['Data / Ora', 'Agenzia', 'Passeggero', 'Telefono', 'Pax', 'Partenza', 'Arrivo', 'Autista']
        };
        const ROW_H = 18;
        const HEADER_H = 22;

        let currentPage = 1;
        let pageY = tableStartY;

        const drawTableHeader = (y: number) => {
            // Sfondo intestazione tabella
            doc.rect(MARGIN, y, CONTENT_W, HEADER_H).fill('#1e3a5f');
            doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
            let x = MARGIN + 4;
            COL.headers.forEach((h, i) => {
                doc.text(h, x, y + 7, { width: COL.widths[i] - 4, align: 'left' });
                x += COL.widths[i];
            });
            doc.fillColor('#000000');
            return y + HEADER_H;
        };

        const drawFooter = () => {
            doc.font('Helvetica').fontSize(7).fillColor('#888888')
                .text(`Pagina ${currentPage}`, 0, PAGE_H - 25, { align: 'center', width: PAGE_W });
            doc.fillColor('#000000');
        };

        const addNewPage = () => {
            drawFooter();
            doc.addPage();
            currentPage++;
            // Intestazione mini sulla nuova pagina
            doc.rect(0, 0, PAGE_W, 28).fill('#11355a');
            doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11)
                .text('RIEPILOGO PRENOTAZIONI (continua)', MARGIN, 9, { align: 'center', width: CONTENT_W });
            doc.fillColor('#000000');
            pageY = drawTableHeader(38);
        };

        // Prima intestazione tabella
        pageY = drawTableHeader(pageY);

        // ── Righe raggruppate per data ────────────────────────────────────
        let rowIndex = 0;
        const sortedDates = Object.keys(byDate).sort((a, b) => {
            // Parsing dd/mm/yyyy
            const [da, ma, ya] = a.split('/').map(Number);
            const [db, mb, yb] = b.split('/').map(Number);
            return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
        });

        sortedDates.forEach(dateKey => {
            const dayBookings = byDate[dateKey];
            const dayPax = dayBookings.reduce((s, b) => s + (b.passengers || 1), 0);

            // Controlla spazio per la riga-separatore data + almeno una riga
            if (pageY + 16 + ROW_H > PAGE_H - 35) {
                addNewPage();
            }

            // ── Separatore data ──────────────────────────────────────────
            doc.rect(MARGIN, pageY, CONTENT_W, 15).fill('#e8f0fe');
            doc.fillColor('#11355a').font('Helvetica-Bold').fontSize(8)
                .text(`📅  ${dateKey}  —  ${dayBookings.length} prenotat${dayBookings.length === 1 ? 'a' : 'e'}  •  ${dayPax} person${dayPax === 1 ? 'a' : 'e'}`,
                    MARGIN + 6, pageY + 4, { width: CONTENT_W - 12 });
            doc.fillColor('#000000');
            pageY += 15;

            // ── Righe prenotazioni del giorno ────────────────────────────
            dayBookings.forEach(b => {
                if (pageY + ROW_H > PAGE_H - 35) {
                    addNewPage();
                }

                // Sfondo alternato
                const bgColor = rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc';
                doc.rect(MARGIN, pageY, CONTENT_W, ROW_H).fill(bgColor);

                // Bordo inferiore sottile
                doc.moveTo(MARGIN, pageY + ROW_H)
                   .lineTo(MARGIN + CONTENT_W, pageY + ROW_H)
                   .strokeColor('#e2e8f0').lineWidth(0.5).stroke()
                   .strokeColor('#000000').lineWidth(1);

                doc.fillColor('#1a202c').font('Helvetica').fontSize(8);
                const rowData = [
                    formatShortDate(b.pickupAt),
                    (b.agency || '-').substring(0, 15),
                    (b.passengerName || '-').substring(0, 22),
                    b.passengerPhone || '-',
                    b.passengers.toString(),
                    (b.origin?.name || b.originRaw || '-').substring(0, 32),
                    (b.destination?.name || b.destinationRaw || '-').substring(0, 32),
                    (b.driver?.name || 'N/A').substring(0, 18)
                ];

                let x = MARGIN + 4;
                rowData.forEach((text, i) => {
                    // Pax in blu, resto normale (nessun prezzo)
                    if (i === 4) doc.fillColor('#2563eb').font('Helvetica-Bold');
                    else doc.fillColor('#1a202c').font('Helvetica');
                    doc.text(text, x, pageY + 5, { width: COL.widths[i] - 4, align: 'left' });
                    x += COL.widths[i];
                });
                doc.fillColor('#000000');

                pageY += ROW_H;
                rowIndex++;
            });

            // Piccolo spazio tra i gruppi di date
            pageY += 4;
        });

        // ── Riga totali finale ────────────────────────────────────────────
        if (pageY + 30 > PAGE_H - 35) {
            addNewPage();
        }
        pageY += 6;
        doc.rect(MARGIN, pageY, CONTENT_W, 24).fill('#11355a');
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
        doc.text(
            `TOTALE  •  ${totalBookings} prenotazion${totalBookings === 1 ? 'e' : 'i'}  •  ${totalPassengers} person${totalPassengers === 1 ? 'a' : 'e'}`,
            MARGIN + 6, pageY + 8, { width: CONTENT_W - 12 }
        );
        doc.fillColor('#000000');

        drawFooter();
        doc.end();
    });
};

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
        const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
        const chunks: Buffer[] = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', err => reject(err));

        // Header
        doc.fontSize(20).text('Riepilogo Prenotazioni', { align: 'center' });
        doc.moveDown();

        // Table Header
        const tableTop = 100;
        const colWidths = [100, 80, 100, 60, 25, 120, 120, 50, 80];
        const headers = ['Data', 'Agenzia', 'Passeggero', 'Telefono', 'Pax', 'Partenza', 'Arrivo', 'Prezzo', 'Stato'];
        
        let currentX = 30;
        doc.fontSize(10).font('Helvetica-Bold');
        headers.forEach((header, i) => {
            doc.text(header, currentX, tableTop, { width: colWidths[i], align: 'left' });
            currentX += colWidths[i];
        });

        doc.moveTo(30, tableTop + 15).lineTo(800, tableTop + 15).stroke();

        // Table Rows
        let currentY = tableTop + 25;
        doc.font('Helvetica').fontSize(9);

        bookings.forEach(b => {
            if (currentY > 500) {
                doc.addPage();
                currentY = 50;
            }

            const rowData = [
                formatShortDate(b.pickupAt),
                b.agency || '-',
                b.passengerName || '-',
                b.passengerPhone || '-',
                b.passengers.toString(),
                (b.origin?.name || b.originRaw || '-').substring(0, 30),
                (b.destination?.name || b.destinationRaw || '-').substring(0, 30),
                b.price ? `€${Number(b.price).toFixed(2)}` : '-',
                b.status
            ];

            let x = 30;
            rowData.forEach((text, i) => {
                doc.text(text, x, currentY, { width: colWidths[i], align: 'left' });
                x += colWidths[i];
            });

            currentY += 20;
        });

        doc.end();
    });
};

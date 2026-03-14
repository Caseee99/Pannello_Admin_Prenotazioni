import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

const prisma = new PrismaClient();

export default async function reportRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
    
    // Helper per ottenere l'intervallo del mese
    const getMonthRange = (month: number, year: number) => {
        const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
        const end = new Date(year, month, 0, 23, 59, 59, 999);
        return { start, end };
    };

    // GET /api/reports/excel?month=3&year=2026
    fastify.get('/excel', async (request, reply) => {
        const { month, year } = request.query as any;
        const m = parseInt(month) || new Date().getMonth() + 1;
        const y = parseInt(year) || new Date().getFullYear();
        const { start, end } = getMonthRange(m, y);

        const bookings = await prisma.booking.findMany({
            where: {
                pickupAt: { gte: start, lte: end },
                status: { in: ['COMPLETED', 'ASSIGNED'] }
            },
            include: {
                driver: true,
                origin: true,
                destination: true
            },
            orderBy: { pickupAt: 'asc' }
        });

        const data = bookings.map(b => ({
            'Data': format(b.pickupAt, 'dd/MM/yyyy HH:mm'),
            'Passeggero': b.passengerName,
            'Telefono': b.passengerPhone,
            'N. Pax': b.passengers,
            'Partenza': b.origin?.name || b.originRaw,
            'Destinazione': b.destination?.name || b.destinationRaw,
            'Autista': b.driver?.name || 'Non assegnato',
            'Prezzo (€)': b.price || 0,
            'Agenzia': b.agency || '-',
            'Note': b.notes || '-'
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Report Mensile');

        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        reply
            .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            .header('Content-Disposition', `attachment; filename=Report_${m}_${y}.xlsx`)
            .send(buffer);
    });

    // GET /api/reports/pdf?month=3&year=2026
    fastify.get('/pdf', async (request, reply) => {
        const { month, year } = request.query as any;
        const m = parseInt(month) || new Date().getMonth() + 1;
        const y = parseInt(year) || new Date().getFullYear();
        const { start, end } = getMonthRange(m, y);

        const bookings = await prisma.booking.findMany({
            where: {
                pickupAt: { gte: start, lte: end },
                status: { in: ['COMPLETED', 'ASSIGNED'] }
            },
            include: {
                driver: true,
                origin: true,
                destination: true
            },
            orderBy: { pickupAt: 'asc' }
        });

        // Aggregazione per autista
        const driverSummary: Record<string, { count: number, total: number }> = {};
        let grandTotal = 0;

        bookings.forEach(b => {
            const name = b.driver?.name || 'Non assegnato';
            if (!driverSummary[name]) driverSummary[name] = { count: 0, total: 0 };
            driverSummary[name].count++;
            driverSummary[name].total += (b.price || 0);
            grandTotal += (b.price || 0);
        });

        const doc = new PDFDocument({ margin: 50 });
        const chunks: Buffer[] = [];

        doc.on('data', chunk => chunks.push(chunk));
        
        // Header
        doc.fontSize(20).text('REPORT MENSILE PRENOTAZIONI', { align: 'center' });
        doc.fontSize(12).text(`Periodo: ${format(start, 'MMMM yyyy', { locale: it }).toUpperCase()}`, { align: 'center' });
        doc.moveDown(2);

        doc.fontSize(14).text('Riepilogo Generale', { underline: true });
        doc.moveDown();
        
        doc.fontSize(10);
        doc.text(`Totale Prenotazioni: ${bookings.length}`);
        doc.text(`Totale Fatturato Stimato: € ${grandTotal.toFixed(2)}`);
        doc.moveDown(2);

        doc.fontSize(14).text('Dettaglio per Autista', { underline: true });
        doc.moveDown();

        Object.entries(driverSummary).forEach(([name, stats]) => {
            doc.fontSize(11).text(`${name}:`, { continued: true });
            doc.fontSize(11).text(` ${stats.count} corse - `, { continued: true });
            doc.font('Helvetica-Bold').text(`€ ${stats.total.toFixed(2)}`);
            doc.font('Helvetica');
        });

        doc.moveDown(2);
        doc.fontSize(14).text('Elenco Analitico Corse', { underline: true });
        doc.moveDown();

        bookings.forEach((b, i) => {
            doc.fontSize(9)
               .text(`${i+1}. ${format(b.pickupAt, 'dd/MM HH:mm')} - ${b.passengerName} (${b.driver?.name || 'N/A'})`)
               .text(`   ${b.origin?.name || b.originRaw} -> ${b.destination?.name || b.destinationRaw} | € ${b.price || 0}`, { color: '#666666' });
            doc.moveDown(0.5);
        });

        doc.end();

        return new Promise((resolve) => {
            doc.on('end', () => {
                const result = Buffer.concat(chunks);
                reply
                    .header('Content-Type', 'application/pdf')
                    .header('Content-Disposition', `attachment; filename=Report_${m}_${y}.pdf`)
                    .send(result);
                resolve(reply);
            });
        });
    });
}

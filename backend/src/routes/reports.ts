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

    // GET /api/reports/excel?month=3&year=2026&agency=NomeAgenzia
    fastify.get('/excel', async (request, reply) => {
        const { month, year, agency } = request.query as any;
        const m = parseInt(month) || new Date().getMonth() + 1;
        const y = parseInt(year) || new Date().getFullYear();
        const { start, end } = getMonthRange(m, y);

        const where: any = {
            pickupAt: { gte: start, lte: end },
            status: { in: ['COMPLETED', 'ASSIGNED'] }
        };
        if (agency && agency !== 'Tutte') {
            where.agency = agency;
        }

        const bookings = await prisma.booking.findMany({
            where,
            include: {
                driver: true,
                origin: true,
                destination: true
            },
            orderBy: { pickupAt: 'asc' }
        });

        const data = bookings.map(b => ({
            'Data': format(b.pickupAt, 'dd/MM/yyyy HH:mm'),
            'Agenzia': b.agency || '-',
            'Passeggero': b.passengerName,
            'Telefono': b.passengerPhone,
            'N. Pax': b.passengers,
            'Partenza': b.origin?.name || b.originRaw,
            'Destinazione': b.destination?.name || b.destinationRaw,
            'Autista': b.driver?.name || 'Non assegnato',
            'Prezzo (€)': b.price || 0,
            'Note': b.notes || '-'
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Report Mensile');

        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        reply
            .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            .header('Content-Disposition', `attachment; filename=Report_${agency || 'Completo'}_${m}_${y}.xlsx`)
            .send(buffer);
    });

    // GET /api/reports/pdf?month=3&year=2026&agency=NomeAgenzia
    fastify.get('/pdf', async (request, reply) => {
        const { month, year, agency } = request.query as any;
        const m = parseInt(month) || new Date().getMonth() + 1;
        const y = parseInt(year) || new Date().getFullYear();
        const { start, end } = getMonthRange(m, y);

        const where: any = {
            pickupAt: { gte: start, lte: end },
            status: { in: ['COMPLETED', 'ASSIGNED'] }
        };
        if (agency && agency !== 'Tutte') {
            where.agency = agency;
        }

        const bookings = await prisma.booking.findMany({
            where,
            include: {
                driver: true,
                origin: true,
                destination: true
            },
            orderBy: { pickupAt: 'asc' }
        });

        const doc = new PDFDocument({ margin: 50 });
        const chunks: Buffer[] = [];
        doc.on('data', chunk => chunks.push(chunk));
        
        // Header
        doc.fontSize(20).text('REPORT PRENOTAZIONI', { align: 'center' });
        doc.fontSize(12).text(`Agenzia: ${agency || 'Tutte le Agenzie'}`, { align: 'center' });
        doc.fontSize(12).text(`Periodo: ${format(start, 'MMMM yyyy', { locale: it }).toUpperCase()}`, { align: 'center' });
        doc.moveDown(2);

        // Raggruppamento per Agenzia (se Tutte)
        const agencySummary: Record<string, { count: number, total: number }> = {};
        let grandTotal = 0;

        bookings.forEach(b => {
            const agName = b.agency || 'Nessuna Agenzia';
            if (!agencySummary[agName]) agencySummary[agName] = { count: 0, total: 0 };
            agencySummary[agName].count++;
            agencySummary[agName].total += (b.price || 0);
            grandTotal += (b.price || 0);
        });

        doc.fontSize(14).text('Riepilogo Agenzie', { underline: true });
        doc.moveDown();
        Object.entries(agencySummary).forEach(([name, stats]) => {
            doc.fontSize(11).text(`${name}: `, { continued: true });
            doc.font('Helvetica-Bold').text(`${stats.count} corse - € ${stats.total.toFixed(2)}`);
            doc.font('Helvetica');
        });
        doc.moveDown();
        doc.fontSize(12).font('Helvetica-Bold').text(`TOTALE GENERALE: € ${grandTotal.toFixed(2)}`);
        doc.font('Helvetica').moveDown(2);

        // Dettaglio Corse
        doc.fontSize(14).text('Elenco Analitico Corse', { underline: true });
        doc.moveDown();

        bookings.forEach((b, i) => {
            doc.fontSize(9)
               .fillColor('#000000')
               .text(`${i+1}. ${format(b.pickupAt, 'dd/MM HH:mm')} - ${b.passengerName} (Ag: ${b.agency || '-'})`)
               .fillColor('#666666')
               .text(`   Autista: ${b.driver?.name || 'N/A'} | ${b.origin?.name || b.originRaw} -> ${b.destination?.name || b.destinationRaw} | € ${b.price || 0}`);
            doc.moveDown(0.5);
        });

        doc.end();

        return new Promise((resolve) => {
            doc.on('end', () => {
                const result = Buffer.concat(chunks);
                reply
                    .header('Content-Type', 'application/pdf')
                    .header('Content-Disposition', `attachment; filename=Report_${agency || 'Completo'}_${m}_${y}.pdf`)
                    .send(result);
                resolve(reply);
            });
        });
    });
}

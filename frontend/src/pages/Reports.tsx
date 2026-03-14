import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ReceiptText, Download } from 'lucide-react';

export default function Reports() {
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedAgency, setSelectedAgency] = useState('Tutte');
    const [completedBookings, setCompletedBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [agencies, setAgencies] = useState<string[]>([]);

    useEffect(() => {
        async function fetchReports() {
            setLoading(true);
            try {
                const res = await api.get('/bookings');
                
                // Estrai tutte le agenzie uniche esistenti nel database
                const uniqueAgencies = Array.from(new Set(res.data.map((b: any) => b.agency).filter(Boolean))) as string[];
                setAgencies(['Tutte', ...uniqueAgencies.sort()]);

                // Filtra prenotazioni COMPLETED o ASSIGNED per il mese selezionato (+ agenzia se non "Tutte")
                const filtered = res.data.filter((b: any) => {
                    const date = new Date(b.pickupAt);
                    const isReportable = b.status === 'COMPLETED' || b.status === 'ASSIGNED';
                    const monthMatch = (date.getMonth() + 1) === selectedMonth;
                    const yearMatch = date.getFullYear() === selectedYear;
                    const agencyMatch = selectedAgency === 'Tutte' || b.agency === selectedAgency;
                    
                    return isReportable && monthMatch && yearMatch && agencyMatch;
                });
                setCompletedBookings(filtered);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        fetchReports();
    }, [selectedMonth, selectedYear, selectedAgency]);

    const handleExportExcel = async () => {
        try {
            const query = `month=${selectedMonth}&year=${selectedYear}&agency=${encodeURIComponent(selectedAgency)}`;
            const response = await api.get(`/reports/excel?${query}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Report_${selectedAgency}_${selectedMonth}_${selectedYear}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Errore esportazione Excel:', err);
            alert('Errore durante la generazione del file Excel.');
        }
    };

    const handleDownloadPDF = async () => {
        try {
            const query = `month=${selectedMonth}&year=${selectedYear}&agency=${encodeURIComponent(selectedAgency)}`;
            const response = await api.get(`/reports/pdf?${query}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Report_${selectedAgency}_${selectedMonth}_${selectedYear}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Errore generazione PDF:', err);
            alert('Errore durante la generazione del file PDF.');
        }
    };

    if (loading && completedBookings.length === 0) return <div>Caricamento in corso...</div>;

    // Simple aggregation for UI
    const driverStats: Record<string, { count: number, revenue: number }> = {};
    completedBookings.forEach((b: any) => {
        const driverName = b.driver?.name || 'Sconosciuto';
        if (!driverStats[driverName]) {
            driverStats[driverName] = { count: 0, revenue: 0 };
        }
        driverStats[driverName].count += 1;
        const fare = b.price || 18; // Usiamo il prezzo della prenotazione
        driverStats[driverName].revenue += fare;
    });

    const months = [
        "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
        "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
    ];

    return (
        <div className="space-y-6">
            <div className="sm:flex sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Report e Pagamenti</h2>
                    <p className="text-muted-foreground">Amministrazione finanziaria e riepilogo per autista.</p>
                </div>
                <div className="mt-4 flex flex-col sm:flex-row gap-4 sm:items-center">
                    <div className="flex gap-2 items-center">
                        <select 
                            className="p-2 border rounded-md text-sm"
                            value={selectedAgency}
                            onChange={(e) => setSelectedAgency(e.target.value)}
                            aria-label="Seleziona Agenzia"
                        >
                            {agencies.map(ag => (
                                <option key={ag} value={ag}>{ag}</option>
                            ))}
                        </select>
                        <select 
                            className="p-2 border rounded-md text-sm"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            aria-label="Seleziona Mese"
                        >
                            {months.map((m, i) => (
                                <option key={m} value={i + 1}>{m}</option>
                            ))}
                        </select>
                        <select 
                            className="p-2 border rounded-md text-sm"
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            aria-label="Seleziona Anno"
                        >
                            {[2024, 2025, 2026].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" className="flex items-center text-green-700 border-green-200 hover:bg-green-50" onClick={handleExportExcel}>
                            <Download className="mr-2 h-4 w-4" />
                            Excel
                        </Button>
                        <Button className="flex items-center bg-red-600 hover:bg-red-700" onClick={handleDownloadPDF}>
                            <Download className="mr-2 h-4 w-4" />
                            PDF Mensile
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader className="bg-gray-50 border-b">
                        <CardTitle className="text-lg font-medium flex items-center">
                            <ReceiptText className="mr-2 h-5 w-5 text-blue-600" />
                            Riepilogo Autisti (Mese Corrente)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {Object.keys(driverStats).length > 0 ? (
                            <div className="space-y-4">
                                {Object.entries(driverStats).map(([driver, stats]) => (
                                    <div key={driver} className="flex justify-between items-center border-b pb-2">
                                        <div>
                                            <h4 className="font-semibold text-gray-800">{driver}</h4>
                                            <p className="text-xs text-gray-500">{stats.count} Corse Completate</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-bold text-lg text-green-700">€ {stats.revenue.toFixed(2)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 text-center py-4">Nessuna corsa completata questo mese.</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div>
                <h3 className="text-lg font-medium mb-4">Ultimi Movimenti</h3>
                <div className="rounded-md border bg-white shadow-sm overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-700 uppercase">
                            <tr>
                                <th className="px-6 py-3 font-medium">Data</th>
                                <th className="px-6 py-3 font-medium">Autista</th>
                                <th className="px-6 py-3 font-medium">Tratta</th>
                                <th className="px-6 py-3 font-medium">Importo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {completedBookings.length > 0 ? completedBookings.map((b: any) => (
                                <tr key={b.id} className="border-b hover:bg-gray-50 bg-white">
                                    <td className="px-6 py-4 whitespace-nowrap">{new Date(b.pickupAt).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 font-medium">{b.driver?.name || 'Sconosciuto'}</td>
                                    <td className="px-6 py-4">{b.origin?.name || b.originRaw} ➔ {b.destination?.name || b.destinationRaw}</td>
                                    <td className="px-6 py-4 font-bold text-green-700">€{b.price || '18'}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={4} className="text-center py-6 text-gray-500">Nessun dato cronologico.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

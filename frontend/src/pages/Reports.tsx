import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ReceiptText, Download, Loader2 } from 'lucide-react';

export default function Reports() {
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedAgency, setSelectedAgency] = useState('Tutte');
    const [completedBookings, setCompletedBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [agencies, setAgencies] = useState<string[]>([]);
    const [allDrivers, setAllDrivers] = useState<any[]>([]);

    const role = typeof window !== 'undefined' ? localStorage.getItem('role') : null;
    const isAgency = role === 'agency';
    const agencyName = typeof window !== 'undefined' ? localStorage.getItem('agencyName') || '' : '';

    useEffect(() => {
        async function fetchReports() {
            setLoading(true);
            try {
                const [bookingsRes, driversRes] = await Promise.all([
                    api.get('/bookings'),
                    api.get('/drivers')
                ]);

                setAllDrivers(driversRes.data || []);
                const res = bookingsRes;

                // Per admin: lista agenzie e filtri completi
                if (!isAgency) {
                    const uniqueAgencies = Array.from(
                        new Set(res.data.map((b: any) => b.agency).filter(Boolean))
                    ) as string[];
                    setAgencies(['Tutte', ...uniqueAgencies.sort()]);
                }

                // Filtra solo prenotazioni COMPLETED per il mese selezionato
                const filtered = res.data.filter((b: any) => {
                    const date = new Date(b.pickupAt);
                    const isReportable = b.status === 'COMPLETED';
                    const monthMatch = (date.getMonth() + 1) === selectedMonth;
                    const yearMatch = date.getFullYear() === selectedYear;

                    // Per admin applichiamo anche il filtro agenzia selezionata
                    if (!isAgency) {
                        const agencyMatch = selectedAgency === 'Tutte' || b.agency === selectedAgency;
                        return isReportable && monthMatch && yearMatch && agencyMatch;
                    }

                    // Per agenzia: backend già filtra le sue prenotazioni, qui bastano mese/anno
                    return isReportable && monthMatch && yearMatch;
                });

                setCompletedBookings(filtered);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        fetchReports();
    }, [selectedMonth, selectedYear, selectedAgency, isAgency]);

    const handleExportExcel = async () => {
        try {
            const queryAgency = isAgency ? encodeURIComponent(agencyName || 'MiaAgenzia') : encodeURIComponent(selectedAgency);
            const query = `month=${selectedMonth}&year=${selectedYear}&agency=${queryAgency}`;
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
            const queryAgency = isAgency ? encodeURIComponent(agencyName || 'MiaAgenzia') : encodeURIComponent(selectedAgency);
            const query = `month=${selectedMonth}&year=${selectedYear}&agency=${queryAgency}`;
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

    if (loading && completedBookings.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <Loader2 className="h-10 w-10 text-[#11355a] animate-spin" />
                <p className="text-gray-500 font-medium italic">Caricamento in corso...</p>
            </div>
        );
    }

    // Aggregazioni per UI
    const driverStats: Record<string, { count: number, revenue: number }> = {};
    
    // Inizializza tutti gli autisti (per l'admin)
    if (!isAgency) {
        allDrivers.forEach(d => {
            driverStats[d.name] = { count: 0, revenue: 0 };
        });
    }

    let totalRevenue = 0;
    completedBookings.forEach((b: any) => {
        const fare = b.price || 0;
        totalRevenue += fare;

        if (!isAgency) {
            const driverName = b.driver?.name || 'Sconosciuto';
            if (!driverStats[driverName]) {
                driverStats[driverName] = { count: 0, revenue: 0 };
            }
            driverStats[driverName].count += 1;
            driverStats[driverName].revenue += fare;
        }
    });

    const months = [
        "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
        "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
    ];

    return (
        <div className="space-y-6">
            <div className="sm:flex sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">
                        {isAgency ? 'I miei report' : 'Report e Pagamenti'}
                    </h2>
                    <p className="text-muted-foreground">
                        {isAgency
                            ? 'Riepilogo delle corse e degli importi dovuti alla cooperativa.'
                            : 'Amministrazione finanziaria e riepilogo per autista.'}
                    </p>
                </div>
                <div className="mt-4 flex flex-col sm:flex-row gap-4 sm:items-center">
                    <div className="flex gap-2 items-center">
                        {!isAgency && (
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
                        )}
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

            {!isAgency && (
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
                                            <div className="text-right flex flex-col items-end">
                                                <span className={`font-bold text-lg ${stats.revenue > 0 ? 'text-green-700' : 'text-gray-400'}`}>
                                                    € {stats.revenue.toFixed(2)}
                                                </span>
                                                {stats.count === 0 && <span className="text-[10px] text-gray-400 italic">Nessun servizio</span>}
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
            )}

            <div>
                <h3 className="text-lg font-medium mb-1">
                    {isAgency ? 'Dettaglio corse del periodo' : 'Ultimi Movimenti'}
                </h3>
                {isAgency && (
                    <p className="text-sm text-gray-500 mb-3">
                        Totale corse: <strong>{completedBookings.length}</strong> &nbsp;|&nbsp; Totale importo: <strong>€{totalRevenue.toFixed(2)}</strong>
                    </p>
                )}
                <div className="rounded-md border bg-white shadow-sm overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-700 uppercase">
                            <tr>
                                <th className="px-6 py-3 font-medium">Data</th>
                                <th className="px-6 py-3 font-medium">Nominativo</th>
                                {!isAgency && <th className="px-6 py-3 font-medium">Agenzia</th>}
                                {!isAgency && <th className="px-6 py-3 font-medium">Autista</th>}
                                <th className="px-6 py-3 font-medium">Tratta</th>
                                <th className="px-6 py-3 font-medium">Importo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {completedBookings.length > 0 ? completedBookings.map((b: any) => (
                                <tr key={b.id} className="border-b hover:bg-gray-50 bg-white">
                                    <td className="px-6 py-4 whitespace-nowrap">{new Date(b.pickupAt).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 font-medium">{b.passengerName || '-'}</td>
                                    {!isAgency && (
                                        <td className="px-6 py-4 text-gray-600 truncate max-w-[120px]">{b.agency || '-'}</td>
                                    )}
                                    {!isAgency && (
                                        <td className="px-6 py-4 font-medium">{b.driver?.name || 'Sconosciuto'}</td>
                                    )}
                                    <td className="px-6 py-4">{b.origin?.name || b.originRaw} ➔ {b.destination?.name || b.destinationRaw}</td>
                                    <td className="px-6 py-4 font-bold text-green-700">€{b.price || '0'}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="text-center py-6 text-gray-500">Nessun dato cronologico.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

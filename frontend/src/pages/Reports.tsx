import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ReceiptText, Download, Loader2, FileCheck, FileText, CheckCircle2, Clock } from 'lucide-react';

export default function Reports() {
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedAgency, setSelectedAgency] = useState('Tutte');
    const [completedBookings, setCompletedBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [agencies, setAgencies] = useState<string[]>([]);
    const [allDrivers, setAllDrivers] = useState<any[]>([]);
    const [agencyInvoices, setAgencyInvoices] = useState<Record<string, any>>({});

    // Modal state per la gestione fatture
    const [editingAgency, setEditingAgency] = useState<string | null>(null);
    const [invoiceNumberInput, setInvoiceNumberInput] = useState('');
    const [invoiceStatusInput, setInvoiceStatusInput] = useState('INVOICED');
    const [invoiceNotesInput, setInvoiceNotesInput] = useState('');
    const [savingInvoice, setSavingInvoice] = useState(false);

    const role = typeof window !== 'undefined' ? localStorage.getItem('role') : null;
    const isAgency = role === 'agency';
    const agencyName = typeof window !== 'undefined' ? localStorage.getItem('agencyName') || '' : '';

    useEffect(() => {
        async function fetchReports() {
            setLoading(true);
            try {
                const [bookingsRes, driversRes, invoicesRes] = await Promise.all([
                    api.get('/bookings'),
                    api.get('/drivers'),
                    api.get(`/reports/agency-invoices?month=${selectedMonth}&year=${selectedYear}`).catch(() => ({ data: [] }))
                ]);

                setAllDrivers(driversRes.data || []);
                const res = bookingsRes;

                const invMap: Record<string, any> = {};
                (invoicesRes.data || []).forEach((inv: any) => {
                    invMap[inv.agencyName] = inv;
                });
                setAgencyInvoices(invMap);

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
                    const romeMonth = parseInt(date.toLocaleDateString('en-CA', { timeZone: 'Europe/Rome', month: '2-digit' }));
                    const romeYear = parseInt(date.toLocaleDateString('en-CA', { timeZone: 'Europe/Rome', year: 'numeric' }));
                    const monthMatch = romeMonth === selectedMonth;
                    const yearMatch = romeYear === selectedYear;

                    if (!isAgency) {
                        const agencyMatch = selectedAgency === 'Tutte' || b.agency === selectedAgency;
                        return isReportable && monthMatch && yearMatch && agencyMatch;
                    }

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

    const openInvoiceModal = (targetAgency: string, currentRev: number) => {
        const inv = agencyInvoices[targetAgency];
        setEditingAgency(targetAgency);
        setInvoiceNumberInput(inv?.invoiceNumber || '');
        setInvoiceStatusInput(inv?.status || 'INVOICED');
        setInvoiceNotesInput(inv?.notes || '');
    };

    const handleSaveInvoice = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingAgency) return;

        setSavingInvoice(true);
        try {
            const rev = agencyStats[editingAgency]?.revenue || 0;
            await api.post('/reports/agency-invoices', {
                agencyName: editingAgency,
                month: selectedMonth,
                year: selectedYear,
                invoiceNumber: invoiceNumberInput,
                status: invoiceStatusInput,
                notes: invoiceNotesInput,
                totalAmount: rev
            });

            // Ricarica le fatture
            const invoicesRes = await api.get(`/reports/agency-invoices?month=${selectedMonth}&year=${selectedYear}`);
            const invMap: Record<string, any> = {};
            (invoicesRes.data || []).forEach((inv: any) => {
                invMap[inv.agencyName] = inv;
            });
            setAgencyInvoices(invMap);
            setEditingAgency(null);
        } catch (err) {
            console.error(err);
            alert('Errore durante il salvataggio dei dati fattura.');
        } finally {
            setSavingInvoice(false);
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
    const agencyStats: Record<string, { count: number, revenue: number }> = {};
    
    // Inizializza tutti gli autisti e le agenzie (per l'admin)
    if (!isAgency) {
        allDrivers.forEach(d => {
            driverStats[d.name] = { count: 0, revenue: 0 };
        });
        agencies.filter(a => a !== 'Tutte').forEach(a => {
            agencyStats[a] = { count: 0, revenue: 0 };
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

            const agencyNameVal = b.agency || 'Nessuna';
            if (!agencyStats[agencyNameVal]) {
                agencyStats[agencyNameVal] = { count: 0, revenue: 0 };
            }
            agencyStats[agencyNameVal].count += 1;
            agencyStats[agencyNameVal].revenue += fare;
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
                        {isAgency ? 'I miei report' : 'Report e Tracciabilità Fatture'}
                    </h2>
                    <p className="text-muted-foreground">
                        {isAgency
                            ? 'Riepilogo delle corse e degli importi dovuti alla cooperativa.'
                            : 'Fatturazione mensile sulle corse completate e rendicontazione.'}
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
                                Riepilogo Autisti ({months[selectedMonth - 1]} {selectedYear})
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

                    <Card>
                        <CardHeader className="bg-gray-50 border-b">
                            <CardTitle className="text-lg font-medium flex items-center justify-between">
                                <span className="flex items-center">
                                    <FileCheck className="mr-2 h-5 w-5 text-purple-600" />
                                    Fatturazione Agenzie ({months[selectedMonth - 1]} {selectedYear})
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            {Object.keys(agencyStats).length > 0 ? (
                                <div className="space-y-4">
                                    {Object.entries(agencyStats).map(([agency, stats]) => {
                                        const inv = agencyInvoices[agency];
                                        const status = inv?.status || 'PENDING';
                                        return (
                                            <div key={agency} className="flex justify-between items-center border-b pb-3">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-semibold text-gray-800">{agency}</h4>
                                                        {status === 'PAID' && (
                                                            <span className="inline-flex items-center text-[11px] font-medium bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                                                <CheckCircle2 className="w-3 h-3 mr-1" /> Saldato
                                                            </span>
                                                        )}
                                                        {status === 'INVOICED' && (
                                                            <span className="inline-flex items-center text-[11px] font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                                                                <FileText className="w-3 h-3 mr-1" /> Fattura N° {inv?.invoiceNumber || 'N/D'}
                                                            </span>
                                                        )}
                                                        {status === 'PENDING' && (
                                                            <span className="inline-flex items-center text-[11px] font-medium bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                                                                <Clock className="w-3 h-3 mr-1" /> Da Fatturare
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-0.5">
                                                        {stats.count} Corse Completate {inv?.notes && `• Note: ${inv.notes}`}
                                                    </p>
                                                </div>
                                                <div className="text-right flex flex-col items-end">
                                                    <span className={`font-bold text-lg ${stats.revenue > 0 ? 'text-green-700' : 'text-gray-400'}`}>
                                                        € {stats.revenue.toFixed(2)}
                                                    </span>
                                                    <button
                                                        onClick={() => openInvoiceModal(agency, stats.revenue)}
                                                        className="text-xs text-blue-600 hover:text-blue-800 font-medium underline mt-0.5"
                                                    >
                                                        {inv ? 'Modifica Tracciabilità' : 'Registra Fattura'}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 text-center py-4">Nessuna corsa di agenzia questo mese.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            <div>
                <h3 className="text-lg font-medium mb-1">
                    {isAgency ? 'Dettaglio corse completate del periodo' : 'Elenco Corse Completate'}
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
                                    <td className="px-6 py-4 whitespace-nowrap">{new Date(b.pickupAt).toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' })}</td>
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
                                    <td colSpan={6} className="text-center py-6 text-gray-500">Nessun dato cronologico per il mese selezionato.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal per Registrazione / Tracciabilità Fattura */}
            {editingAgency && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
                        <div className="flex justify-between items-center border-b pb-3">
                            <h3 className="text-lg font-bold text-gray-900">
                                Tracciabilità Fattura Mensile
                            </h3>
                            <button 
                                onClick={() => setEditingAgency(null)}
                                className="text-gray-400 hover:text-gray-600 font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveInvoice} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Agenzia</label>
                                <input 
                                    type="text" 
                                    disabled 
                                    value={editingAgency} 
                                    className="w-full p-2 border rounded bg-gray-100 text-gray-700 text-sm" 
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Periodo</label>
                                <input 
                                    type="text" 
                                    disabled 
                                    value={`${months[selectedMonth - 1]} ${selectedYear}`} 
                                    className="w-full p-2 border rounded bg-gray-100 text-gray-700 text-sm" 
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Stato Fattura</label>
                                <select 
                                    value={invoiceStatusInput}
                                    onChange={(e) => setInvoiceStatusInput(e.target.value)}
                                    className="w-full p-2 border rounded text-sm bg-white"
                                >
                                    <option value="PENDING">⏳ Da Fatturare (Pending)</option>
                                    <option value="INVOICED">📄 Fatturato (Fattura Emessa)</option>
                                    <option value="PAID">✓ Saldato (Pagamento Ricevuto)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Numero Fattura / Riferimento</label>
                                <input 
                                    type="text"
                                    placeholder="Es. FAT-2026/042"
                                    value={invoiceNumberInput}
                                    onChange={(e) => setInvoiceNumberInput(e.target.value)}
                                    className="w-full p-2 border rounded text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Note (Opzionale)</label>
                                <textarea 
                                    rows={2}
                                    placeholder="Es. Inviata via PEC il 02/04, bonifico a 30gg"
                                    value={invoiceNotesInput}
                                    onChange={(e) => setInvoiceNotesInput(e.target.value)}
                                    className="w-full p-2 border rounded text-sm"
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t">
                                <Button type="button" variant="outline" onClick={() => setEditingAgency(null)}>
                                    Annulla
                                </Button>
                                <Button type="submit" className="bg-[#11355a] hover:bg-[#0c2642]" disabled={savingInvoice}>
                                    {savingInvoice ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                    Salva Tracciabilità
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}


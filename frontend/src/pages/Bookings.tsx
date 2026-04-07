// Deploy trigger: updated UI and responsive filters
import { useEffect, useState } from 'react';
import api from '../lib/api';
import { X, Car, Plus, Edit2, Info, Search, Loader2, FileDown, Download, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Bookings() {
    const [bookings, setBookings] = useState<any[]>([]);
    const [drivers, setDrivers] = useState<any[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [partnerAgencies, setPartnerAgencies] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filteredBookings, setFilteredBookings] = useState<any[]>([]);

    // Filtri Rapidi e Mobile
    const [quickDateFilter, setQuickDateFilter] = useState('ALL');
    const [showFiltersMobile, setShowFiltersMobile] = useState(false);

    // Filtri
    const [filters, setFilters] = useState({
        status: '',
        driverId: '',
        originId: '',
        date: '',
        passengerName: ''
    });

    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const [showAddModal, setShowAddModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState<any>(null);
    const [editingBooking, setEditingBooking] = useState<any>(null);
    const [formData, setFormData] = useState({
        pickupDate: '',
        pickupTime: '',
        agencyId: '',
        agency: '',
        passengers: 1,
        price: '',
        passengerName: '',
        passengerPhone: '',
        notes: '',
        originId: '',
        destinationId: '',
        originRaw: '',
        destinationRaw: '',
        isRoundTrip: false,
        returnDate: '',
        returnTime: ''
    });

    const role = typeof window !== 'undefined' ? localStorage.getItem('role') : null;
    const isAgency = role === 'agency';
    const agencyName = typeof window !== 'undefined' ? localStorage.getItem('agencyName') || '' : '';

    const fetchData = async (silent = false) => {
        try {
            if (!silent) setLoading(true);

            // Chiamate base comuni
            const fetchTasks: Promise<any>[] = [
                api.get('/bookings'),
                api.get('/locations')
            ];

            // Solo admin carica tutto il resto
            if (!isAgency) {
                fetchTasks.push(api.get('/drivers'));
                fetchTasks.push(api.get('/agencies'));
            }

            const results = await Promise.allSettled(fetchTasks);

            // Gestione dei risultati (con fallback)
            const getVal = (idx: number) => {
                const res = results[idx];
                return (res && res.status === 'fulfilled') ? (res as any).value.data : [];
            };

            const bookingsData = getVal(0);
            const locationsData = getVal(1);

            setBookings(bookingsData);
            setLocations(locationsData.filter((l: any) => l.active));

            if (!isAgency) {
                const driversData = getVal(2);
                const agenciesData = getVal(3);
                setDrivers(driversData.filter((d: any) => d.active));
                setPartnerAgencies(agenciesData.filter((a: any) => a.active));
            }
        } catch (e) {
            console.error(e);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const handleAddClick = () => {
        setEditingBooking(null);
        setFormData({
            pickupDate: '', pickupTime: '', agencyId: '', agency: isAgency ? agencyName : '', passengers: 1, price: '',
            passengerName: '', passengerPhone: '', notes: '',
            originId: '', destinationId: '', originRaw: '', destinationRaw: '',
            isRoundTrip: false, returnDate: '', returnTime: ''
        });
        setShowAddModal(true);
    };

    const handleEditClick = (b: any) => {
        const pickupAt = new Date(b.pickupAt);
        const matchedAgency = partnerAgencies.find(a => a.name === b.agency);

        // Converte l'ora UTC dal DB in ora di Roma per pre-popolare il form
        const romeDate = pickupAt.toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' }); // YYYY-MM-DD
        const romeTime = pickupAt.toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' });

        setEditingBooking(b);
        setFormData({
            pickupDate: romeDate,
            pickupTime: romeTime,
            agencyId: matchedAgency ? matchedAgency.id : (b.agency ? 'OTHER' : ''),
            agency: b.agency || agencyName || '',
            passengers: b.passengers || 1,
            price: b.price || '',
            passengerName: b.passengerName || '',
            passengerPhone: b.passengerPhone || '',
            notes: b.notes || '',
            originId: b.originId || (b.originRaw ? 'OTHER' : ''),
            destinationId: b.destinationId || (b.destinationRaw ? 'OTHER' : ''),
            originRaw: b.originRaw || '',
            destinationRaw: b.destinationRaw || '',
            isRoundTrip: false,
            returnDate: '',
            returnTime: ''
        });
        setShowAddModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Invia stringa ISO naive (senza Z) così il backend la interpreta come ora di Roma
            const pickupAt = `${formData.pickupDate}T${formData.pickupTime}:00`;

            // Risolvi correttamente il nome agenzia dall'ID selezionato
            let resolvedAgencyName = formData.agency;
            let resolvedAgencyId: string | null = null;

            if (formData.agencyId === 'OTHER') {
                // Inserimento manuale: usa il testo scritto, nessun ID
                resolvedAgencyName = formData.agency;
                resolvedAgencyId = null;
            } else if (formData.agencyId) {
                // Agenzia selezionata dal dropdown: recupera il nome dalla lista
                const found = partnerAgencies.find(a => a.id === formData.agencyId);
                resolvedAgencyName = found ? found.name : formData.agency;
                resolvedAgencyId = formData.agencyId;
            } else {
                // Nessuna agenzia selezionata (privato)
                resolvedAgencyName = formData.agency || '';
                resolvedAgencyId = null;
            }

            const payload = {
                ...formData,
                pickupAt,
                agency: resolvedAgencyName,
                agencyId: resolvedAgencyId,
                originId: formData.originId === 'OTHER' ? null : (formData.originId || null),
                destinationId: formData.destinationId === 'OTHER' ? null : (formData.destinationId || null),
            };

            if (editingBooking) {
                await api.patch(`/bookings/${editingBooking.id}`, payload);
            } else {
                await api.post('/bookings', payload);

                if (formData.isRoundTrip && formData.returnDate && formData.returnTime) {
                    const returnAt = `${formData.returnDate}T${formData.returnTime}:00`;
                    const returnPayload = {
                        ...payload,
                        pickupAt: returnAt,
                        originId: payload.destinationId,
                        destinationId: payload.originId,
                        originRaw: payload.destinationRaw,
                        destinationRaw: payload.originRaw,
                        isRoundTrip: false,
                        notes: `[RITORNO] ${payload.notes || ''}`.trim()
                    };
                    await api.post('/bookings', returnPayload);
                }
            }

            setShowAddModal(false);
            fetchData();
        } catch (e) {
            console.error(e);
            alert('Errore nel salvataggio della prenotazione');
        }
    };

    const handleShowDetail = (b: any) => {
        setSelectedBooking(b);
        setShowDetailModal(true);
    };

    const handleComplete = async (b: any) => {
        if (!confirm('Vuoi segnare questa prenotazione come COMPLETATA?')) return;
        try {
            await api.patch(`/bookings/${b.id}`, { status: 'COMPLETED' });
            fetchData(true);
        } catch (e) {
            console.error(e);
            alert('Errore nell\'aggiornamento dello stato');
        }
    };

    useEffect(() => {
        let result = [...bookings];

        // 1. Quick Filters (Oggi, Domani, Prossimi 7 giorni)
        if (quickDateFilter !== 'ALL') {
            const todayRome = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Rome" }));
            todayRome.setHours(0, 0, 0, 0);

            result = result.filter(b => {
                const bDateRome = new Date(new Date(b.pickupAt).toLocaleString("en-US", { timeZone: "Europe/Rome" }));
                bDateRome.setHours(0, 0, 0, 0);
                
                const diffTime = bDateRome.getTime() - todayRome.getTime();
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

                if (quickDateFilter === 'TODAY') return diffDays === 0;
                if (quickDateFilter === 'TOMORROW') return diffDays === 1;
                if (quickDateFilter === 'NEXT_7_DAYS') return diffDays >= 0 && diffDays <= 7;
                return true;
            });
        }

        // 2. Normal Filters
        if (filters.status && filters.status !== 'Tutti') {
            if (isAgency && filters.status === 'CONFIRMED') {
                result = result.filter(b => b.status === 'CONFIRMED' || b.status === 'ASSIGNED');
            } else {
                result = result.filter(b => b.status === filters.status);
            }
        }

        if (filters.driverId && filters.driverId !== 'Tutti') {
            result = result.filter(b => b.driverId === filters.driverId);
        }

        if (filters.originId && filters.originId !== 'Tutte') {
            result = result.filter(b => b.originId === filters.originId);
        }

        if (filters.date) {
            result = result.filter(b => {
                const bDate = new Date(b.pickupAt).toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' });
                return bDate === filters.date;
            });
        }

        if (filters.passengerName) {
            const search = filters.passengerName.toLowerCase();
            result = result.filter(b => 
                (b.passengerName && b.passengerName.toLowerCase().includes(search)) ||
                (b.passengerPhone && b.passengerPhone.includes(search))
            );
        }

        setFilteredBookings(result);
    }, [bookings, filters, quickDateFilter]);

    const handleSearch = () => {
        // La ricerca ora è reattiva tramite useEffect su [bookings, filters]
        // ma manteniamo il pulsante per "scatenare" il refresh se servisse
        fetchData(true);
    };

    const handleResendNotification = async (b: any) => {
        if (!confirm(`Vuoi reinviare l'email di notifica a ${b.driver?.name}?`)) return;
        try {
            await api.post(`/bookings/${b.id}/resend-notification`);
            setSelectedBooking({ ...b, driverNotified: true }); // Assuming 'b' is the booking to update
            alert('Notifica inviata con successo.');
        } catch (error: any) {
            console.error('Errore nel reinvio della notifica:', error);
            const msg = error.response?.data?.message || error.message || 'Errore sconosciuto';
            alert(`Errore nell'invio della notifica: ${msg}`);
        }
    };

    const cancelBooking = async (id: string) => {
        if (!confirm('Sei sicuro di voler CANCELLARE questa prenotazione? L\'azione non è reversibile.')) return;
        try {
            await api.delete(`/bookings/${id}`);
            fetchData();
        } catch (e) {
            console.error(e);
            alert('Errore nella cancellazione');
        }
    };

    const handleExport = async (format: 'excel' | 'pdf') => {
        try {
            const response = await api.post('/bookings/export', {
                ids: selectedIds,
                format,
                ...filters
            }, { responseType: 'blob' });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `prenotazioni.${format === 'excel' ? 'xlsx' : 'pdf'}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (e) {
            console.error(e);
            alert('Errore durante l\'esportazione');
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredBookings.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredBookings.map(b => b.id));
        }
    };

    const toggleSelectOne = (id: string) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        // Controllo se dobbiamo aprire il modale in automatico (es. da Dashboard)
        const params = new URLSearchParams(window.location.search);
        if (params.get('openModal') === 'true') {
            handleAddClick();
            // Pulisco l'URL per evitare riaperture indesiderate al refresh
            window.history.replaceState({}, '', window.location.pathname);
        }

        const detailId = params.get('openDetail');
        if (detailId && bookings.length > 0) {
            const found = bookings.find(b => b.id === detailId);
            if (found) {
                handleShowDetail(found);
            }
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, [bookings]);

    const STATUS_COLORS: Record<string, string> = {
        CONFIRMED: 'bg-amber-100 text-amber-800 border-amber-300',
        ASSIGNED: 'bg-[#2a9d8f]/10 text-[#2a9d8f] border-[#2a9d8f]/20',
        COMPLETED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        CANCELLED: 'bg-red-100 text-red-800 border-red-200',
    };

    const STATUS_LABELS: Record<string, string> = {
        CONFIRMED: 'Da assegnare',
        ASSIGNED: 'Assegnata',
        COMPLETED: 'Completata',
        CANCELLED: 'Annullata',
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 space-y-4">
            <Loader2 className="h-12 w-12 text-[#11355a] animate-spin" />
            <p className="text-gray-500 font-medium">Caricamento in corso...</p>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                        {isAgency ? 'Le mie Prenotazioni' : 'Gestione Prenotazioni'}
                    </h2>
                    <p className="text-gray-500 mt-1">
                        {isAgency
                            ? 'Inserisci e controlla le prenotazioni della tua agenzia.'
                            : 'Inserisci e gestisci le prenotazioni manuali e assegna gli autisti.'}
                    </p>
                </div>
                <Button onClick={handleAddClick} className="bg-[#11355a] hover:bg-[#11355a]/90 text-white rounded-xl h-11 px-6 shadow-sm">
                    <Plus className="mr-2 h-5 w-5" /> Nuova Prenotazione
                </Button>
            </div>

            <div className="space-y-6">

                {/* Quick Filters e Controlli Mobile */}
                <div className="flex flex-col gap-4">
                    {/* Quick Filters Pills */}
                        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                        {['ALL', 'TODAY', 'TOMORROW', 'NEXT_7_DAYS'].map(f => {
                            const labels = { ALL: 'Tutte', TODAY: 'Oggi', TOMORROW: 'Domani', NEXT_7_DAYS: 'Prossimi 7 gg' };
                            return (
                                <button
                                    key={f}
                                    onClick={() => setQuickDateFilter(f)}
                                    className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold transition-all shadow-sm ${quickDateFilter === f ? 'bg-[#11355a] text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}
                                >
                                    {labels[f as keyof typeof labels]}
                                </button>
                            );
                        })}
                    </div>

                    {/* Bottone Filtri Mobile */}
                    <div className="md:hidden">
                        <Button 
                            variant="outline" 
                            className="w-full justify-between border-gray-200 text-gray-700 bg-white rounded-xl h-11"
                            onClick={() => setShowFiltersMobile(!showFiltersMobile)}
                        >
                            <span className="flex items-center font-semibold"><Search className="w-4 h-4 mr-2" /> Ricerca e Filtri</span>
                            <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-bold">{showFiltersMobile ? 'Nascondi' : 'Mostra'}</span>
                        </Button>
                    </div>

                    {/* Filters Box */}
                    <div className={`rounded-2xl bg-white shadow-sm border border-gray-100 p-4 md:p-5 transition-all duration-300 ${showFiltersMobile ? 'block' : 'hidden md:block'}`}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
                            <div className="col-span-1">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 pl-1">Stato</label>
                                <select
                                    title="Filtra per Stato"
                                    className="w-full border border-gray-100 rounded-xl p-2 text-sm text-gray-600 bg-gray-50/30 hover:bg-white focus:bg-white transition-all outline-none focus:ring-2 focus:ring-[#11355a]/10"
                                    value={filters.status}
                                    onChange={e => setFilters({ ...filters, status: e.target.value })}
                                >
                                    <option value="">Tutti gli stati</option>
                                    <option value="CONFIRMED">Confermate</option>
                                    <option value="COMPLETED">Completata</option>
                                    <option value="CANCELLED">Annullata</option>
                                </select>
                            </div>
                            {!isAgency && (
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 pl-1">Autista</label>
                                    <select
                                        title="Filtra per Autista"
                                        className="w-full border border-gray-100 rounded-xl p-2 text-sm text-gray-600 bg-gray-50/30 hover:bg-white focus:bg-white transition-all outline-none focus:ring-2 focus:ring-[#11355a]/10"
                                        value={filters.driverId}
                                        onChange={e => setFilters({ ...filters, driverId: e.target.value })}
                                    >
                                        <option value="">Tutti</option>
                                        {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                </div>
                            )}
                            <div className="col-span-1">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 pl-1">Partenza</label>
                                <select
                                    title="Filtra per Tratta"
                                    className="w-full border border-gray-100 rounded-xl p-2 text-sm text-gray-600 bg-gray-50/30 hover:bg-white focus:bg-white transition-all outline-none focus:ring-2 focus:ring-[#11355a]/10"
                                    value={filters.originId}
                                    onChange={e => setFilters({ ...filters, originId: e.target.value })}
                                >
                                    <option value="">Tutte le tratte</option>
                                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                </select>
                            </div>
                            <div className="col-span-1 lg:col-span-2">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 pl-1">Cliente / Telefono</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Cerca nome o numero..."
                                        className="w-full border border-gray-100 rounded-xl p-2 pl-9 text-sm text-gray-600 bg-gray-50/30 hover:bg-white focus:bg-white transition-all outline-none focus:ring-2 focus:ring-[#11355a]/10"
                                        value={filters.passengerName}
                                        onChange={e => setFilters({ ...filters, passengerName: e.target.value })}
                                    />
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                </div>
                            </div>
                            <div className="col-span-1">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 pl-1">Data Specifica</label>
                                <input
                                    type="date"
                                    title="Seleziona Data Specifica"
                                    className="w-full border border-gray-100 rounded-xl p-2 text-sm text-gray-600 bg-gray-50/30 hover:bg-white focus:bg-white transition-all outline-none focus:ring-2 focus:ring-[#11355a]/10"
                                    value={filters.date}
                                    onChange={e => setFilters({ ...filters, date: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Search and Export Buttons */}
                        <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-3 border-t border-gray-50 pt-4">
                            <div className="flex gap-2 w-full sm:w-auto">
                                <Button onClick={handleSearch} className="bg-[#11355a] hover:bg-[#11355a]/90 text-white rounded-xl h-9 px-5 flex-1 sm:flex-none text-xs font-semibold">
                                    Applica Filtri
                                </Button>
                                <Button 
                                    onClick={() => {
                                        setFilters({ status: '', driverId: '', originId: '', date: '', passengerName: '' });
                                        setQuickDateFilter('ALL');
                                    }} 
                                    variant="ghost"
                                    className="text-gray-400 rounded-xl h-9 px-4 hover:bg-gray-50 flex-1 sm:flex-none text-xs font-semibold"
                                >
                                    Resetta
                                </Button>
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto">
                                <Button 
                                    onClick={() => handleExport('excel')} 
                                    variant="outline" 
                                    className="border-gray-100 text-gray-500 rounded-xl h-9 px-4 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-100 flex-1 sm:flex-none text-xs"
                                >
                                    <Download className="h-3.5 w-3.5 mr-2 text-emerald-500" /> Excel
                                </Button>
                                <Button 
                                    onClick={() => handleExport('pdf')} 
                                    variant="outline" 
                                    className="border-gray-100 text-gray-500 rounded-xl h-9 px-4 hover:bg-red-50 hover:text-red-600 hover:border-red-100 flex-1 sm:flex-none text-xs"
                                >
                                    <FileDown className="h-3.5 w-3.5 mr-2 text-red-500" /> PDF
                                </Button>
                            </div>
                        </div>
                    </div>

                </div>

                <div className="rounded-xl border border-gray-100 shadow-sm bg-white overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left hidden md:table">
                            <thead className="text-gray-400 text-[10px] font-bold uppercase tracking-widest border-b border-gray-50 bg-gray-50/50">
                                <tr>
                                    <th className="px-4 py-3 font-semibold text-left w-10">
                                        <button onClick={toggleSelectAll} title="Seleziona tutto" className="text-gray-300 hover:text-[#11355a] transition-colors">
                                            {selectedIds.length === filteredBookings.length && filteredBookings.length > 0 ? (
                                                <CheckSquare className="h-4 w-4 text-[#11355a]" />
                                            ) : (
                                                <Square className="h-4 w-4" />
                                            )}
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 font-semibold">Data/Ora</th>
                                    {!isAgency && <th className="px-4 py-3 font-semibold">Agenzia</th>}
                                    <th className="px-4 py-3 font-semibold">Tratta</th>
                                    <th className="px-4 py-3 font-semibold text-center">Pax</th>
                                    <th className="px-4 py-3 font-semibold">Passeggero</th>
                                    {!isAgency && <th className="px-4 py-3 font-semibold">Autista</th>}
                                    <th className="px-4 py-3 font-semibold">Prezzo</th>
                                    <th className="px-4 py-3 font-semibold">Stato</th>
                                    <th className="px-4 py-3 font-semibold text-right">Azioni</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 hidden md:table-row-group">
                                {filteredBookings.length > 0 ? filteredBookings.map((b) => (
                                    <tr key={b.id} className={`hover:bg-[#11355a]/[0.02] transition-colors group ${b.status === 'COMPLETED' ? 'bg-emerald-50/10' : ''} ${selectedIds.includes(b.id) ? 'bg-blue-50/50' : ''}`}>
                                        <td className="px-4 py-3">
                                            <button onClick={() => toggleSelectOne(b.id)} title="Seleziona riga" className="text-gray-300 hover:text-[#11355a] transition-colors">
                                                {selectedIds.includes(b.id) ? (
                                                    <CheckSquare className="h-4 w-4 text-[#11355a]" />
                                                ) : (
                                                    <Square className="h-4 w-4" />
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="text-gray-900 font-bold text-xs uppercase">{new Date(b.pickupAt).toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit' })}</span>
                                                <span className="text-gray-400 text-[10px] font-medium">{new Date(b.pickupAt).toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </td>
                                        {!isAgency && (
                                            <td className="px-4 py-3">
                                                <span className="text-[10px] font-black text-[#11355a]/70 uppercase tracking-tight">{b.agency || '---'}</span>
                                            </td>
                                        )}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2 max-w-[200px]">
                                                <span className="text-[11px] font-bold text-gray-700 truncate">{b.origin?.name || b.originRaw || '---'}</span>
                                                <span className="text-gray-300 text-[10px]">➔</span>
                                                <span className="text-[11px] font-bold text-[#11355a] truncate">{b.destination?.name || b.destinationRaw || '---'}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="bg-gray-100 text-gray-700 text-[10px] font-black px-2 py-0.5 rounded-md">{b.passengers || 1}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <span className="text-gray-900 font-bold text-xs truncate max-w-[120px]">{b.passengerName || '---'}</span>
                                                <span className="text-gray-400 text-[9px] font-medium tracking-tighter truncate">{b.passengerPhone || '---'}</span>
                                            </div>
                                        </td>
                                        {!isAgency && (
                                            <td className="px-4 py-3">
                                                <span className="text-gray-600 font-bold text-xs">{b.driver?.name || '---'}</span>
                                            </td>
                                        )}
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className="text-gray-900 font-black text-xs">€{b.price ? Number(b.price).toFixed(0) : '0'}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className={`inline-flex items-center px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter rounded-md border ${STATUS_COLORS[isAgency && b.status === 'ASSIGNED' ? 'CONFIRMED' : b.status] || 'bg-gray-50 text-gray-400 border-gray-100'}`}>
                                                {(isAgency && b.status === 'ASSIGNED') ? STATUS_LABELS['CONFIRMED'] : (STATUS_LABELS[b.status] || b.status)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {!isAgency && b.status !== 'CANCELLED' && b.status !== 'COMPLETED' && (
                                                    <select
                                                        title="Assegna un autista"
                                                        className="text-[9px] bg-[#11355a] text-white border-none rounded px-2 py-1 font-bold outline-none cursor-pointer hover:bg-[#11355a]/90 transition-all max-w-[80px]"
                                                        value={b.driverId || ''}
                                                        onChange={async (e) => {
                                                            const driverId = e.target.value;
                                                            if (!driverId) return;
                                                            const selectedDriver = drivers.find(d => d.id === driverId);
                                                            setBookings(prev => prev.map(book =>
                                                                book.id === b.id ? { ...book, driverId, driver: selectedDriver, status: 'ASSIGNED' } : book
                                                            ));
                                                            try {
                                                                await api.patch(`/bookings/${b.id}`, { driverId });
                                                                fetchData(true);
                                                            } catch (err) {
                                                                fetchData();
                                                            }
                                                        }}
                                                    >
                                                        <option value="">{b.driver ? 'Cambia' : 'Assegna'}</option>
                                                        {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                                    </select>
                                                )}
                                                <button onClick={() => handleShowDetail(b)} className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Dettagli">
                                                    <Info className="h-4 w-4" />
                                                </button>
                                                {!isAgency && b.status === 'ASSIGNED' && (
                                                    <button onClick={() => handleComplete(b)} className="p-1.5 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all" title="Completa">
                                                        <CheckSquare className="h-4 w-4" />
                                                    </button>
                                                )}
                                                {b.status !== 'CANCELLED' && b.status !== 'COMPLETED' && (
                                                    <button onClick={() => handleEditClick(b)} className="p-1.5 text-gray-400 hover:text-[#11355a] hover:bg-gray-100 rounded-lg transition-all" title="Modifica">
                                                        <Edit2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                                {b.status !== 'CANCELLED' && b.status !== 'COMPLETED' && (
                                                    <button onClick={() => cancelBooking(b.id)} className="p-1.5 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Annulla">
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )) : null}
                            </tbody>
                        </table>


                        {/* Mobile Grid View (Alternative to table) */}
                        <div className="md:hidden grid grid-cols-1 gap-3 p-3 bg-gray-50/30">
                            {filteredBookings.length > 0 ? filteredBookings.map((b) => (
                                <div key={b.id} className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3 transition-all ${selectedIds.includes(b.id) ? 'ring-1 ring-blue-400 border-blue-400' : ''}`}>
                                    <div className="flex items-start justify-between">
                                        <div className="flex gap-2.5">
                                            <button onClick={() => toggleSelectOne(b.id)} className="shrink-0 mt-0.5">
                                                {selectedIds.includes(b.id) ? (
                                                    <CheckSquare className="h-4 w-4 text-[#11355a]" />
                                                ) : (
                                                    <Square className="h-4 w-4 text-gray-200" />
                                                )}
                                            </button>
                                            <div className="bg-[#11355a]/5 text-[#11355a] h-10 w-10 rounded-xl flex flex-col items-center justify-center border border-[#11355a]/5">
                                                <span className="text-[10px] font-black leading-none">{new Date(b.pickupAt).toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', day: 'numeric' })}</span>
                                                <span className="text-[8px] font-bold uppercase opacity-60 leading-none mt-0.5">{new Date(b.pickupAt).toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', month: 'short' })}</span>
                                            </div>
                                            <div>
                                                <p className="font-black text-[#11355a] text-xs leading-none mb-1.5">{new Date(b.pickupAt).toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' })}</p>
                                                <div className={`inline-flex px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tight border ${STATUS_COLORS[isAgency && b.status === 'ASSIGNED' ? 'CONFIRMED' : b.status] || 'bg-gray-50 text-gray-400 border-gray-100'}`}>
                                                    {isAgency && b.status === 'ASSIGNED' ? STATUS_LABELS['CONFIRMED'] : (STATUS_LABELS[b.status] || b.status)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-black text-gray-900 leading-none mb-1">€{b.price ? Number(b.price).toFixed(0) : '0'}</p>
                                            {!isAgency && <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">{b.agency || 'Privato'}</span>}
                                        </div>
                                    </div>

                                    <div className="p-2.5 bg-gray-50/50 rounded-xl border border-gray-50">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-gray-700 truncate">{b.origin?.name || b.originRaw || '---'}</span>
                                            <span className="text-gray-300 text-[8px]">➔</span>
                                            <span className="text-[10px] font-bold text-[#11355a] truncate">{b.destination?.name || b.destinationRaw || '---'}</span>
                                        </div>
                                        <div className="mt-1.5 flex items-center justify-between">
                                            <span className="text-[9px] font-bold text-gray-500">{b.passengerName}</span>
                                            <span className="bg-white px-1.5 py-0.5 rounded text-[8px] font-black text-gray-400 border border-gray-100">{b.passengers || 1} PAX</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-1 gap-2">
                                        <div className="flex gap-1.5">
                                            <button onClick={() => handleShowDetail(b)} title="Visualizza Dettagli" className="p-2 bg-blue-50 text-blue-500 rounded-lg hover:bg-blue-100 transition-all">
                                                <Info className="h-3.5 w-3.5" />
                                            </button>
                                            {b.status !== 'CANCELLED' && b.status !== 'COMPLETED' && (
                                                <button onClick={() => handleEditClick(b)} title="Modifica Prenotazione" className="p-2 bg-gray-50 text-gray-400 rounded-lg hover:bg-gray-100 transition-all">
                                                    <Edit2 className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>
                                        
                                        {!isAgency && b.status === 'CONFIRMED' ? (
                                            <select
                                                title="Assegna Autista (Mobile)"
                                                className="bg-[#11355a] text-white rounded-lg h-8 px-3 text-[10px] font-black outline-none border-none appearance-none"
                                                value=""
                                                onChange={async (e) => {
                                                    const driverId = e.target.value;
                                                    if (!driverId) return;
                                                    const selectedDriver = drivers.find(d => d.id === driverId);
                                                    setBookings(prev => prev.map(book =>
                                                        book.id === b.id ? { ...book, driverId, driver: selectedDriver, status: 'ASSIGNED' } : book
                                                    ));
                                                    try {
                                                        await api.patch(`/bookings/${b.id}`, { driverId });
                                                        fetchData(true);
                                                    } catch (err) {
                                                        fetchData();
                                                    }
                                                }}
                                            >
                                                <option value="" disabled>Assegna</option>
                                                {drivers.map(d => <option key={d.id} value={d.id} className="text-gray-900 bg-white">{d.name}</option>)}
                                            </select>
                                        ) : !isAgency && b.status === 'ASSIGNED' ? (
                                            <Button
                                                onClick={() => handleComplete(b)}
                                                className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg h-8 px-4 text-[10px] font-black"
                                            >
                                                Completa
                                            </Button>
                                        ) : null}
                                    </div>
                                </div>
                            )) : null}
                        </div>


                        {filteredBookings.length === 0 && (
                            <div className="text-center py-20 text-gray-500">
                                <div className="flex flex-col items-center justify-center opacity-30">
                                    <Car className="h-16 w-16 mb-4" />
                                    <p className="text-lg font-medium">Nessuna prenotazione trovata.</p>
                                    <p className="text-sm">Prova a cambiare i filtri di ricerca.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Manual Booking / Edit Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl relative overflow-hidden flex flex-col max-h-[92vh]">
                        <div className="bg-[#11355a] p-6 text-white flex justify-between items-center flex-shrink-0">
                            <div>
                                <h3 className="text-xl font-bold">{editingBooking ? 'Modifica Prenotazione' : 'Nuova Prenotazione Manuale'}</h3>
                                <p className="text-blue-100/70 text-xs mt-0.5">Inserisci tutti i dati richiesti per il trasferimento.</p>
                            </div>
                            <button onClick={() => setShowAddModal(false)} title="Chiudi" className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 overflow-y-auto custom-scrollbar flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Row 1: Date & Time */}
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Data</label>
                                            <input required title="Data del prelievo" type="date" className="w-full border-gray-200 rounded-xl p-3 text-sm focus:ring-primary focus:border-primary shadow-sm" value={formData.pickupDate} onChange={e => setFormData({ ...formData, pickupDate: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Ora</label>
                                            <input required title="Ora del prelievo" type="time" className="w-full border-gray-200 rounded-xl p-3 text-sm focus:ring-primary focus:border-primary shadow-sm" value={formData.pickupTime} onChange={e => setFormData({ ...formData, pickupTime: e.target.value })} />
                                        </div>
                                    </div>

                                    {!isAgency && (
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Agenzia / Mittente</label>
                                            <select
                                                className="w-full border-gray-200 rounded-xl p-3 text-sm focus:ring-primary focus:border-primary shadow-sm mb-2"
                                                value={formData.agencyId}
                                                title="Seleziona agenzia"
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setFormData({
                                                        ...formData,
                                                        agencyId: val,
                                                        agency: val === 'OTHER' ? '' : (partnerAgencies.find(a => a.id === val)?.name || '')
                                                    });
                                                }}
                                            >
                                                <option value="">Nessuna / Privato</option>
                                                {partnerAgencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                                <option value="OTHER" className="font-bold text-primary">ALTRO (Inserimento manuale)</option>
                                            </select>
                                            {(formData.agencyId === 'OTHER' || (!formData.agencyId && formData.agency)) && (
                                                <input
                                                    className="w-full border-primary/30 rounded-xl p-3 text-sm bg-blue-50/30 animate-in slide-in-from-top-2 duration-200"
                                                    placeholder="Inserisci nome mittente"
                                                    value={formData.agency}
                                                    onChange={e => setFormData({ ...formData, agency: e.target.value })}
                                                />
                                            )}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">N. Persone</label>
                                            <input required title="Numero di passeggeri" type="number" min="1" className="w-full border-gray-200 rounded-xl p-3 text-sm text-center shadow-sm" value={formData.passengers} onChange={e => setFormData({ ...formData, passengers: parseInt(e.target.value) || 1 })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Prezzo (€)</label>
                                            <input type="number" step="0.01" className="w-full border-gray-200 rounded-xl p-3 text-sm font-bold text-emerald-600 shadow-sm" placeholder="0.00" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} />
                                        </div>
                                    </div>
                                </div>

                                {/* Row 2: Locations & Customer */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Partenza (Da)</label>
                                        <select required title="Seleziona Località di Partenza" className="w-full border-gray-200 rounded-xl p-3 text-sm shadow-sm mb-2" value={formData.originId} onChange={e => setFormData({ ...formData, originId: e.target.value })}>
                                            <option value="">Seleziona...</option>
                                            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                            <option value="OTHER" className="font-bold text-primary">ALTRO (Inserimento manuale)</option>
                                        </select>
                                        {formData.originId === 'OTHER' && (
                                            <input required title="Indirizzo Partenza Manuale" placeholder="Inserisci indirizzo di partenza" className="w-full border-primary/30 rounded-xl p-3 text-sm bg-blue-50/30 animate-in slide-in-from-top-2 duration-200" value={formData.originRaw} onChange={e => setFormData({ ...formData, originRaw: e.target.value })} />
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Arrivo (A)</label>
                                        <select required title="Seleziona Località di Arrivo" className="w-full border-gray-200 rounded-xl p-3 text-sm shadow-sm mb-2" value={formData.destinationId} onChange={e => setFormData({ ...formData, destinationId: e.target.value })}>
                                            <option value="">Seleziona...</option>
                                            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                            <option value="OTHER" className="font-bold text-primary">ALTRO (Inserimento manuale)</option>
                                        </select>
                                        {formData.destinationId === 'OTHER' && (
                                            <input required title="Indirizzo Arrivo Manuale" placeholder="Inserisci indirizzo di arrivo" className="w-full border-primary/30 rounded-xl p-3 text-sm bg-blue-50/30 animate-in slide-in-from-top-2 duration-200" value={formData.destinationRaw} onChange={e => setFormData({ ...formData, destinationRaw: e.target.value })} />
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nominativo Cliente</label>
                                        <input required className="w-full border-gray-200 rounded-xl p-3 text-sm shadow-sm" placeholder="Nome e Cognome" value={formData.passengerName} onChange={e => setFormData({ ...formData, passengerName: e.target.value })} />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Cellulare</label>
                                        <input required className="w-full border-gray-200 rounded-xl p-3 text-sm shadow-sm" placeholder="340 0000000" value={formData.passengerPhone} onChange={e => setFormData({ ...formData, passengerPhone: e.target.value })} />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 border-t border-gray-100 pt-4">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Note Interne</label>
                                <textarea rows={2} className="w-full border-gray-200 rounded-xl p-3 text-sm shadow-sm" placeholder="Note aggiuntive per l'autista..." value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
                            </div>

                            {!editingBooking && (
                                <div className="mt-6 p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="bg-blue-600 p-2 rounded-lg text-white">
                                                <Plus className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">Aggiungi Ritorno</p>
                                                <p className="text-[10px] text-gray-500">Crea automaticamente una prenotazione inversa.</p>
                                            </div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            title="Abilita Ritorno"
                                            className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            checked={formData.isRoundTrip}
                                            onChange={e => setFormData({ ...formData, isRoundTrip: e.target.checked })}
                                        />
                                    </div>

                                    {formData.isRoundTrip && (
                                        <div className="mt-4 grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Data Ritorno</label>
                                                <input required title="Seleziona Data Ritorno" type="date" className="w-full border-gray-200 rounded-xl p-2.5 text-sm shadow-sm" value={formData.returnDate} onChange={e => setFormData({ ...formData, returnDate: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Ora Ritorno</label>
                                                <input required title="Seleziona Ora Ritorno" type="time" className="w-full border-gray-200 rounded-xl p-2.5 text-sm shadow-sm" value={formData.returnTime} onChange={e => setFormData({ ...formData, returnTime: e.target.value })} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex justify-end space-x-3 pt-8 mt-4 border-t border-gray-100">
                                <Button type="button" variant="outline" className="rounded-xl px-6" onClick={() => setShowAddModal(false)}>Annulla</Button>
                                <Button type="submit" className="bg-[#11355a] hover:bg-[#11355a]/90 text-white rounded-xl px-10 h-11 shadow-lg shadow-blue-900/10">
                                    {editingBooking ? 'Salva Modifiche' : 'Invia e Salva'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {showDetailModal && selectedBooking && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col">
                        <div className="bg-[#11355a] p-6 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold">Dettagli Prenotazione</h3>
                                <p className="text-blue-100/70 text-xs">Riepilogo completo della corsa</p>
                            </div>
                            <button onClick={() => setShowDetailModal(false)} title="Chiudi Dettagli" className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-8 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Data e Ora</p>
                                    <p className="font-semibold text-gray-900">
                                        {new Date(selectedBooking.pickupAt).toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' })} {new Date(selectedBooking.pickupAt).toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Stato</p>
                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_COLORS[isAgency && selectedBooking.status === 'ASSIGNED' ? 'CONFIRMED' : selectedBooking.status]}`}>
                                        {isAgency && selectedBooking.status === 'ASSIGNED' ? STATUS_LABELS['CONFIRMED'] : STATUS_LABELS[selectedBooking.status]}
                                    </span>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Percorso</p>
                                    <p className="text-sm font-bold text-[#11355a]">
                                        {selectedBooking.origin?.name || selectedBooking.originRaw}
                                    </p>
                                    <p className="text-gray-300 text-xs my-0.5 ml-2">▼</p>
                                    <p className="text-sm font-bold text-[#11355a]">
                                        {selectedBooking.destination?.name || selectedBooking.destinationRaw}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Passeggero</p>
                                    <p className="font-semibold text-gray-900">{selectedBooking.passengerName}</p>
                                    <p className="text-xs text-gray-500">{selectedBooking.passengerPhone}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Dettagli</p>
                                    <p className="text-sm text-gray-900">{selectedBooking.passengers} Pax • {selectedBooking.price ? `€${selectedBooking.price}` : 'P. da concordare'}</p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Notifica Driver</p>
                                    <div className="flex items-center gap-2">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${selectedBooking.driverNotified ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {selectedBooking.driverNotified ? 'EMAIL INVIATA' : 'EMAIL NON INVIATA'}
                                        </span>
                                        {!isAgency && selectedBooking.driverId && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-[10px] font-bold border-blue-200 text-blue-600 hover:bg-blue-50"
                                                onClick={() => handleResendNotification(selectedBooking)}
                                            >
                                                Reinvia Ora
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                {!isAgency && selectedBooking.driver && (
                                    <div className="col-span-2 p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-center gap-3">
                                        <Car className="h-5 w-5 text-blue-600" />
                                        <div>
                                            <p className="text-[10px] font-bold text-blue-400 uppercase">Autista Assegnato</p>
                                            <p className="font-bold text-[#11355a]">{selectedBooking.driver.name} • {selectedBooking.driver.licensePlate}</p>
                                        </div>
                                    </div>
                                )}
                                <div className="col-span-2">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Note</p>
                                    <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-600 min-h-[60px]">
                                        {selectedBooking.notes || 'Nessuna nota presente.'}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                            {selectedBooking.status !== 'CANCELLED' && selectedBooking.status !== 'COMPLETED' && (
                                <Button
                                    onClick={() => {
                                        setShowDetailModal(false);
                                        handleEditClick(selectedBooking);
                                    }}
                                    variant="outline"
                                    className="border-[#11355a] text-[#11355a] rounded-xl px-8 h-10 font-bold"
                                >
                                    Modifica
                                </Button>
                            )}
                            <Button onClick={() => setShowDetailModal(false)} className="bg-[#11355a] text-white rounded-xl px-8 h-10">Chiudi</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

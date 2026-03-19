import { useEffect, useState } from 'react';
import api from '../lib/api';
import { X, Car, Plus, Edit2, Info, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Bookings() {
    const [bookings, setBookings] = useState<any[]>([]);
    const [drivers, setDrivers] = useState<any[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [partnerAgencies, setPartnerAgencies] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filteredBookings, setFilteredBookings] = useState<any[]>([]);
    
    // Filtri
    const [filters, setFilters] = useState({
        status: '',
        driverId: '',
        originId: '',
        date: ''
    });

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
        
        setEditingBooking(b);
        setFormData({
            pickupDate: pickupAt.toISOString().split('T')[0],
            pickupTime: pickupAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
            agencyId: b.agencyId || (b.agency ? 'OTHER' : ''),
            agency: b.agency || '',
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
            const pickupAt = new Date(`${formData.pickupDate}T${formData.pickupTime}`);
            const payload = {
                ...formData,
                pickupAt,
                agency: formData.agencyId === 'OTHER' ? formData.agency : (partnerAgencies.find(a => a.id === formData.agencyId)?.name || formData.agency || ''),
                agencyId: formData.agencyId === 'OTHER' ? null : formData.agencyId,
                originId: formData.originId === 'OTHER' ? null : formData.originId,
                destinationId: formData.destinationId === 'OTHER' ? null : formData.destinationId,
            };

            if (editingBooking) {
                await api.patch(`/bookings/${editingBooking.id}`, payload);
            } else {
                // Crea prenotazione di ANDATA
                await api.post('/bookings', payload);
                
                // Se è ANDATA E RITORNO, crea prenotazione di RITORNO
                if (formData.isRoundTrip && formData.returnDate && formData.returnTime) {
                    const returnAt = new Date(`${formData.returnDate}T${formData.returnTime}`);
                    const returnPayload = {
                        ...payload,
                        pickupAt: returnAt,
                        // Scambiamo partenza e arrivo
                        originId: payload.destinationId,
                        destinationId: payload.originId,
                        originRaw: payload.destinationRaw,
                        destinationRaw: payload.originRaw,
                        isRoundTrip: false, // Evitiamo loop infiniti se mai aggiungessimo logiche diverse
                        notes: `[RITORNO] ${payload.notes}`.trim()
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
        
        if (filters.status && filters.status !== 'Tutti') {
            result = result.filter(b => b.status === filters.status);
        }
        
        if (filters.driverId && filters.driverId !== 'Tutti') {
            result = result.filter(b => b.driverId === filters.driverId);
        }
        
        if (filters.originId && filters.originId !== 'Tutte') {
            result = result.filter(b => b.originId === filters.originId);
        }
        
        if (filters.date) {
            result = result.filter(b => {
                const bDate = new Date(b.pickupAt).toISOString().split('T')[0];
                return bDate === filters.date;
            });
        }
        
        setFilteredBookings(result);
    }, [bookings, filters]);

    const handleSearch = () => {
        // La ricerca ora è reattiva tramite useEffect su [bookings, filters]
        // ma manteniamo il pulsante per "scatenare" il refresh se servisse
        fetchData(true);
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

    useEffect(() => {
        fetchData();
        
        // Controllo se dobbiamo aprire il modale in automatico (es. da Dashboard)
        const params = new URLSearchParams(window.location.search);
        if (params.get('openModal') === 'true') {
            handleAddClick();
            // Pulisco l'URL per evitare riaperture indesiderate al refresh
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

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
                
                {/* Filters Box */}
                <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-6 hidden md:block">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Filtri</p>
                    <div className="flex items-end gap-4">
                        <div className="flex-1">
                            <label className="block text-xs text-gray-500 mb-1">Stato</label>
                            <select 
                                className="w-full border border-gray-200 rounded-lg p-2 text-sm text-gray-700 bg-white"
                                value={filters.status}
                                onChange={e => setFilters({ ...filters, status: e.target.value })}
                            >
                                <option value="">Tutti</option>
                                <option value="CONFIRMED">Da assegnare</option>
                                <option value="ASSIGNED">Assegnata</option>
                                <option value="COMPLETED">Completata</option>
                                <option value="CANCELLED">Annullata</option>
                            </select>
                        </div>
                        {!isAgency && (
                            <div className="flex-1">
                                <label className="block text-xs text-gray-500 mb-1">Autista</label>
                                <select 
                                    className="w-full border border-gray-200 rounded-lg p-2 text-sm text-gray-700 bg-white"
                                    value={filters.driverId}
                                    onChange={e => setFilters({ ...filters, driverId: e.target.value })}
                                >
                                    <option value="">Tutti</option>
                                    {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                        )}
                        <div className="flex-1">
                            <label className="block text-xs text-gray-500 mb-1">Partenza</label>
                            <select 
                                className="w-full border border-gray-200 rounded-lg p-2 text-sm text-gray-700 bg-white"
                                value={filters.originId}
                                onChange={e => setFilters({ ...filters, originId: e.target.value })}
                            >
                                <option value="">Tutte</option>
                                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs text-gray-500 mb-1">Dalla data</label>
                            <input 
                                type="date" 
                                className="w-full border border-gray-200 rounded-lg p-2 text-sm text-gray-700 bg-white" 
                                value={filters.date}
                                onChange={e => setFilters({ ...filters, date: e.target.value })}
                            />
                        </div>
                        <Button onClick={handleSearch} className="bg-[#11355a] text-white rounded-lg h-10 px-4">
                            <Search className="h-4 w-4 mr-2" /> Cerca
                        </Button>
                    </div>
                </div>

                <div className="rounded-xl border border-gray-100 shadow-sm bg-white overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-gray-400 text-xs font-medium border-b border-gray-100 bg-gray-50/30">
                                <tr>
                                    <th className="px-4 py-4 font-normal text-left">Data/Ora</th>
                                    {!isAgency && <th className="px-4 py-4 font-normal text-left">Agenzia</th>}
                                    <th className="px-4 py-4 font-normal text-left">Tratta</th>
                                    <th className="px-4 py-4 font-normal text-left">Pax</th>
                                    <th className="px-4 py-4 font-normal text-left">Passeggero</th>
                                    {!isAgency && <th className="px-4 py-4 font-normal text-left">Autista</th>}
                                    <th className="px-4 py-4 font-normal text-left">Prezzo</th>
                                    <th className="px-4 py-4 font-normal text-left">Stato</th>
                                    <th className="px-4 py-4 font-normal text-right">Azioni</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 hidden md:table-row-group">
                                {filteredBookings.length > 0 ? filteredBookings.map((b) => (
                                    <tr key={b.id} className={`hover:bg-gray-50/50 transition-colors group ${b.status === 'COMPLETED' ? 'bg-emerald-50/20' : ''}`}>
                                            <td className="px-4 py-4 whitespace-nowrap text-gray-900 font-medium shrink-0">
                                                <div className="flex flex-col">
                                                    <span className="text-xs">{new Date(b.pickupAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
                                                    <span className="text-gray-400 text-[10px]">{new Date(b.pickupAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            </td>
                                            {!isAgency && (
                                                <td className="px-4 py-4 text-xs font-semibold text-[#11355a] uppercase tracking-wider truncate max-w-[120px]">
                                                    {b.agency || '---'}
                                                </td>
                                            )}
                                            <td className="px-4 py-4 text-gray-700">
                                                <div className="flex flex-col max-w-[150px]">
                                                    <span className="font-semibold truncate text-[#11355a] text-xs leading-tight">{b.origin?.name || b.originRaw || '---'}</span>
                                                    <span className="text-gray-300 text-[8px] leading-tight my-0.5 ml-1">▼</span>
                                                    <span className="font-semibold truncate text-[#11355a] text-xs leading-tight">{b.destination?.name || b.destinationRaw || '---'}</span>
                                                </div>
                                            </td>
                                            <td className="px-2 py-4 text-gray-800 text-center font-bold">
                                                {b.passengers || 1}
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex flex-col max-w-[120px]">
                                                    <span className="text-gray-900 font-semibold truncate text-xs">{b.passengerName || '---'}</span>
                                                    <span className="text-gray-400 text-[10px] truncate">{b.passengerPhone || '---'}</span>
                                                </div>
                                            </td>
                                            {!isAgency && (
                                                <td className="px-4 py-4 text-gray-900 font-medium hidden md:table-cell">
                                                    {b.driver?.name || '---'}
                                                </td>
                                            )}
                                            <td className="px-4 py-4">
                                                {b.price ? `€${Number(b.price).toFixed(0)}` : '---'}
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className={`inline-flex items-center px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full ${STATUS_COLORS[b.status] || 'bg-gray-100 text-gray-600'}`}>
                                                    {STATUS_LABELS[b.status] || b.status}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {!isAgency && b.status !== 'CANCELLED' && b.status !== 'COMPLETED' && (
                                                        <select
                                                            className="text-[10px] bg-gray-50 border border-transparent hover:border-gray-200 rounded p-1 font-bold text-[#11355a] outline-none cursor-pointer transition-all max-w-[80px]"
                                                            value={b.driverId || ''}
                                                            onChange={async (e) => {
                                                                const driverId = e.target.value;
                                                                if (!driverId) return;
                                                                
                                                                const selectedDriver = drivers.find(d => d.id === driverId);
                                                                setBookings(prev => prev.map(book => 
                                                                    book.id === b.id 
                                                                        ? { ...book, driverId, driver: selectedDriver, status: 'ASSIGNED' } 
                                                                        : book
                                                                ));

                                                                try {
                                                                    await api.patch(`/bookings/${b.id}`, { driverId });
                                                                    fetchData(true);
                                                                } catch (err) {
                                                                    console.error(err);
                                                                    alert('Errore nell\'assegnazione');
                                                                    fetchData();
                                                                }
                                                            }}
                                                        >
                                                            <option value="">{b.driver ? 'Cambia' : 'Assegna'}</option>
                                                            {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                                        </select>
                                                    )}
                                                    <button
                                                        className="p-1 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                                                        onClick={() => handleShowDetail(b)}
                                                        title="Dettagli"
                                                    >
                                                        <Info className="h-4 w-4" />
                                                    </button>
                                                    {!isAgency && b.status === 'ASSIGNED' && (
                                                        <button
                                                            className="p-1 rounded-lg text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 transition-all"
                                                            onClick={() => handleComplete(b)}
                                                            title="Completa"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                                                        </button>
                                                    )}
                                                    {b.status !== 'CANCELLED' && b.status !== 'COMPLETED' && (
                                                        <button
                                                            className="p-1 rounded-lg text-gray-400 hover:text-[#11355a] hover:bg-gray-50 transition-all"
                                                            onClick={() => handleEditClick(b)}
                                                            title="Modifica"
                                                        >
                                                            <Edit2 className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                    {b.status !== 'CANCELLED' && b.status !== 'COMPLETED' && (
                                                        <button
                                                            className="p-1 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-all"
                                                            onClick={() => cancelBooking(b.id)}
                                                            title="Annulla"
                                                        >
                                                            <X className="h-4 w-4 stroke-[3]" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                    </tr>
                                )) : null}
                            </tbody>
                        </table>

                        {/* Mobile Grid View (Alternative to table) */}
                        <div className="md:hidden grid grid-cols-1 gap-4 p-4 bg-gray-50/50">
                            {filteredBookings.length > 0 ? filteredBookings.map((b) => (
                                <div key={b.id} className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4 ${b.status === 'COMPLETED' ? 'bg-emerald-50/30' : ''}`}>
                                    <div className="flex items-start justify-between">
                                        <div className="flex gap-3">
                                            <div className="bg-blue-50 text-[#11355a] p-2.5 rounded-xl text-center min-w-[50px] border border-blue-100 shrink-0">
                                                <p className="text-[10px] font-bold uppercase opacity-60 m-0 leading-none mb-1">{new Date(b.pickupAt).toLocaleDateString('it-IT', { month: 'short' })}</p>
                                                <p className="text-lg font-black leading-none">{new Date(b.pickupAt).getDate()}</p>
                                            </div>
                                            <div>
                                                <p className="font-bold text-[#11355a] leading-tight mb-1">{new Date(b.pickupAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</p>
                                                <div className={`p-1 rounded-lg ${b.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'} text-[10px] font-bold px-2 flex items-center`}>
                                                    {STATUS_LABELS[b.status] || b.status}
                                                    {isAgency && b.driver && (
                                                        <span className="ml-1 opacity-50">• Assegnato</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <div className="text-right">
                                                <p className="text-xs font-bold text-[#11355a] leading-none mb-1">
                                                    {b.price ? `€${Number(b.price).toFixed(0)}` : '---'}
                                                </p>
                                                {!isAgency && <p className="text-[10px] text-gray-500 font-medium">{b.agency}</p>}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-3 bg-gray-50 rounded-xl space-y-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full shrink-0"></div>
                                            <p className="text-xs font-bold text-gray-700 truncate">{b.origin?.name || b.originRaw || '---'}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full shrink-0"></div>
                                            <p className="text-xs font-bold text-gray-900 truncate">{b.destination?.name || b.destinationRaw || '---'}</p>
                                        </div>
                                    </div>

                                    {!isAgency && b.driver && (
                                        <div className="flex items-center gap-2 text-xs font-bold text-[#11355a] bg-blue-50/50 p-2 rounded-lg">
                                            <Car className="h-3.5 w-3.5 opacity-50" />
                                            <span>Autista: {b.driver.name}</span>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 gap-2">
                                        <div className="flex gap-1.5">
                                            <button onClick={() => handleShowDetail(b)} title="Dettagli" className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors">
                                                <Info className="h-4 w-4" />
                                            </button>
                                            {b.status !== 'CANCELLED' && b.status !== 'COMPLETED' && (
                                                <button onClick={() => handleEditClick(b)} title="Modifica" className="p-2.5 bg-gray-100 text-gray-500 rounded-xl hover:bg-gray-200 transition-colors">
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                            )}
                                            {b.status !== 'CANCELLED' && b.status !== 'COMPLETED' && (
                                                <button onClick={() => cancelBooking(b.id)} title="Annulla" className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors">
                                                    <X className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                        {!isAgency && b.status === 'ASSIGNED' && (
                                            <Button 
                                                onClick={() => handleComplete(b)}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 px-4 text-xs font-bold shrink-0"
                                            >
                                                Completa
                                            </Button>
                                        )}
                                        {!isAgency && b.status === 'CONFIRMED' && (
                                            <Button 
                                                onClick={() => handleEditClick(b)}
                                                className="bg-[#11355a] hover:bg-[#11355a]/90 text-white rounded-xl h-10 px-4 text-xs font-bold shrink-0"
                                            >
                                                Assegna
                                            </Button>
                                        )}
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
                            <button onClick={() => setShowAddModal(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors">
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
                                            <input required type="date" className="w-full border-gray-200 rounded-xl p-3 text-sm focus:ring-primary focus:border-primary shadow-sm" value={formData.pickupDate} onChange={e => setFormData({ ...formData, pickupDate: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Ora</label>
                                            <input required type="time" className="w-full border-gray-200 rounded-xl p-3 text-sm focus:ring-primary focus:border-primary shadow-sm" value={formData.pickupTime} onChange={e => setFormData({ ...formData, pickupTime: e.target.value })} />
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
                                            <input required type="number" min="1" className="w-full border-gray-200 rounded-xl p-3 text-sm text-center shadow-sm" value={formData.passengers} onChange={e => setFormData({ ...formData, passengers: parseInt(e.target.value) || 1 })} />
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
                                        <select required className="w-full border-gray-200 rounded-xl p-3 text-sm shadow-sm mb-2" value={formData.originId} onChange={e => setFormData({ ...formData, originId: e.target.value })}>
                                            <option value="">Seleziona...</option>
                                            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                            <option value="OTHER" className="font-bold text-primary">ALTRO (Inserimento manuale)</option>
                                        </select>
                                        {formData.originId === 'OTHER' && (
                                            <input required placeholder="Inserisci indirizzo di partenza" className="w-full border-primary/30 rounded-xl p-3 text-sm bg-blue-50/30 animate-in slide-in-from-top-2 duration-200" value={formData.originRaw} onChange={e => setFormData({ ...formData, originRaw: e.target.value })} />
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Arrivo (A)</label>
                                        <select required className="w-full border-gray-200 rounded-xl p-3 text-sm shadow-sm mb-2" value={formData.destinationId} onChange={e => setFormData({ ...formData, destinationId: e.target.value })}>
                                            <option value="">Seleziona...</option>
                                            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                            <option value="OTHER" className="font-bold text-primary">ALTRO (Inserimento manuale)</option>
                                        </select>
                                        {formData.destinationId === 'OTHER' && (
                                            <input required placeholder="Inserisci indirizzo di arrivo" className="w-full border-primary/30 rounded-xl p-3 text-sm bg-blue-50/30 animate-in slide-in-from-top-2 duration-200" value={formData.destinationRaw} onChange={e => setFormData({ ...formData, destinationRaw: e.target.value })} />
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
                                            className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            checked={formData.isRoundTrip}
                                            onChange={e => setFormData({ ...formData, isRoundTrip: e.target.checked })}
                                        />
                                    </div>
                                    
                                    {formData.isRoundTrip && (
                                        <div className="mt-4 grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Data Ritorno</label>
                                                <input required type="date" className="w-full border-gray-200 rounded-xl p-2.5 text-sm shadow-sm" value={formData.returnDate} onChange={e => setFormData({ ...formData, returnDate: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Ora Ritorno</label>
                                                <input required type="time" className="w-full border-gray-200 rounded-xl p-2.5 text-sm shadow-sm" value={formData.returnTime} onChange={e => setFormData({ ...formData, returnTime: e.target.value })} />
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
                            <button onClick={() => setShowDetailModal(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        
                        <div className="p-8 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Data e Ora</p>
                                    <p className="font-semibold text-gray-900">
                                        {new Date(selectedBooking.pickupAt).toLocaleDateString('it-IT')} {new Date(selectedBooking.pickupAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Stato</p>
                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_COLORS[selectedBooking.status]}`}>
                                        {STATUS_LABELS[selectedBooking.status]}
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
                                {selectedBooking.driver && (
                                    <div className="col-span-2 p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-center gap-3">
                                        <Car className="h-5 w-5 text-blue-600" />
                                        <div>
                                            <p className="text-[10px] font-bold text-blue-400 uppercase">Autista Assegnato</p>
                                            <p className="font-bold text-blue-900">{selectedBooking.driver.name}</p>
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

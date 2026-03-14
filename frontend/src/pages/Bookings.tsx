import { useEffect, useState } from 'react';
import api from '../lib/api';
import { X, Car, Plus, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Bookings() {
    const [bookings, setBookings] = useState<any[]>([]);
    const [drivers, setDrivers] = useState<any[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [showAddModal, setShowAddModal] = useState(false);
    const [editingBooking, setEditingBooking] = useState<any>(null);
    const [formData, setFormData] = useState({
        pickupDate: '',
        pickupTime: '',
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
            const [bookingsRes, driversRes, locationsRes] = await Promise.all([
                api.get('/bookings'),
                api.get('/drivers'),
                api.get('/locations')
            ]);
            setBookings(bookingsRes.data);
            // Le agenzie non devono gestire gli autisti, ma gli admin sì
            setDrivers(driversRes.data.filter((d: any) => d.active));
            setLocations(locationsRes.data.filter((l: any) => l.active));
        } catch (e) {
            console.error(e);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const handleAddClick = () => {
        setEditingBooking(null);
        setFormData({
            pickupDate: '', pickupTime: '', agency: isAgency ? agencyName : '', passengers: 1, price: '',
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
            const pickupAt = new Date(`${formData.pickupDate}T${formData.pickupTime}`);
            const payload = {
                ...formData,
                pickupAt,
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
    }, []);

    const STATUS_COLORS: Record<string, string> = {
        CONFIRMED: 'bg-[#fef3c7] text-[#d97706]', // yellow-100 / amber-600
        ASSIGNED: 'bg-blue-100 text-blue-800',
        COMPLETED: 'bg-emerald-100 text-emerald-800',
        CANCELLED: 'bg-[#fee2e2] text-[#ef4444]', // red-100 / red-500
    };

    const STATUS_LABELS: Record<string, string> = {
        CONFIRMED: 'Da assegnare',
        ASSIGNED: 'Assegnata',
        COMPLETED: 'Completata',
        CANCELLED: 'Annullata',
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Caricamento in corso...</div>;

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
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <label className="block text-xs text-gray-500 mb-1">Stato</label>
                            <select className="w-full border border-gray-200 rounded-lg p-2 text-sm text-gray-700 bg-white"><option>Tutti</option></select>
                        </div>
                        {!isAgency && (
                            <div className="flex-1">
                                <label className="block text-xs text-gray-500 mb-1">Autista</label>
                                <select className="w-full border border-gray-200 rounded-lg p-2 text-sm text-gray-700 bg-white"><option>Tutti</option></select>
                            </div>
                        )}
                        <div className="flex-1">
                            <label className="block text-xs text-gray-500 mb-1">Partenza</label>
                            <select className="w-full border border-gray-200 rounded-lg p-2 text-sm text-gray-700 bg-white"><option>Tutte</option></select>
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs text-gray-500 mb-1">Dalla data</label>
                            <input type="date" className="w-full border border-gray-200 rounded-lg p-2 text-sm text-gray-700 bg-white" />
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-gray-100 shadow-sm bg-white overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-gray-400 text-xs font-medium border-b border-gray-100 bg-gray-50/30">
                                <tr>
                                    <th className="px-6 py-4 font-normal">Data/Ora</th>
                                    <th className="px-6 py-4 font-normal">Agenzia</th>
                                    <th className="px-6 py-4 font-normal">Tratta</th>
                                    <th className="px-4 py-4 font-normal w-12 text-center">Pax</th>
                                    <th className="px-6 py-4 font-normal">Passeggero</th>
                                    {!isAgency && <th className="px-6 py-4 font-normal">Autista</th>}
                                    <th className="px-6 py-4 font-normal">Prezzo</th>
                                    <th className="px-6 py-4 font-normal">Stato</th>
                                    <th className="px-6 py-4 font-normal text-right">Azioni</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {bookings.length > 0 ? bookings.map((b) => (
                                    <tr key={b.id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-6 py-5 whitespace-nowrap text-gray-900 font-medium font-sans">
                                                <div className="flex flex-col">
                                                    <span>{new Date(b.pickupAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
                                                    <span className="text-gray-400 text-xs">{new Date(b.pickupAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-gray-600 font-medium">
                                                {b.agency || '---'}
                                            </td>
                                            <td className="px-6 py-5 text-gray-700">
                                                <div className="flex flex-col max-w-[200px]">
                                                    <span className="font-semibold truncate text-[#11355a]">{b.origin?.name || b.originRaw || '---'}</span>
                                                    <span className="text-gray-300 text-[10px] leading-none my-1">▼</span>
                                                    <span className="font-semibold truncate text-[#11355a]">{b.destination?.name || b.destinationRaw || '---'}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-5 text-gray-800 text-center font-bold">
                                                {b.passengers || 1}
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col">
                                                    <span className="text-gray-900 font-semibold">{b.passengerName || '---'}</span>
                                                    <span className="text-gray-400 text-xs">{b.passengerPhone || '---'}</span>
                                                </div>
                                            </td>
                                            {!isAgency && (
                                                <td className="px-6 py-5">
                                                    {b.driver ? (
                                                        <div className="flex items-center text-primary font-bold">
                                                            <Car className="h-3.5 w-3.5 mr-1.5 opacity-50" />
                                                            {b.driver.name}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-300 italic">Non assegnato</span>
                                                    )}
                                                </td>
                                            )}
                                            <td className="px-6 py-5 text-gray-900 font-bold">
                                                {b.price ? `€${Number(b.price).toFixed(2)}` : '---'}
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className={`inline-flex items-center px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${STATUS_COLORS[b.status] || 'bg-gray-100 text-gray-600'}`}>
                                                    {STATUS_LABELS[b.status] || b.status}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 whitespace-nowrap text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {!isAgency && b.status !== 'CANCELLED' && (
                                                        <select
                                                            className="text-xs bg-gray-50 border border-transparent hover:border-gray-200 rounded-lg p-1.5 font-bold text-[#11355a] outline-none cursor-pointer transition-all"
                                                            value={b.driverId || ''}
                                                            onChange={async (e) => {
                                                                const driverId = e.target.value;
                                                                if (!driverId) return;
                                                                
                                                                // Aggiornamento Ottimistico della UI
                                                                const selectedDriver = drivers.find(d => d.id === driverId);
                                                                setBookings(prev => prev.map(book => 
                                                                    book.id === b.id 
                                                                        ? { ...book, driverId, driver: selectedDriver, status: 'ASSIGNED' } 
                                                                        : book
                                                                ));

                                                                try {
                                                                    await api.patch(`/bookings/${b.id}`, { driverId });
                                                                    // Refresh silenzioso in background per confermare i dati
                                                                    fetchData(true);
                                                                } catch (err) {
                                                                    console.error(err);
                                                                    alert('Errore nell\'assegnazione dell\'autista');
                                                                    fetchData(); // Ricarica completa in caso di errore per ripristinare lo stato
                                                                }
                                                            }}
                                                        >
                                                            <option value="">{b.driver ? 'Cambia' : 'Assegna'}</option>
                                                            {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                                        </select>
                                                    )}
                                                    <button
                                                        className="p-1.5 rounded-lg text-gray-400 hover:text-[#11355a] hover:bg-gray-50 transition-all"
                                                        onClick={() => handleEditClick(b)}
                                                        title="Modifica Prenotazione"
                                                    >
                                                        <Edit2 className="h-4 w-4" />
                                                    </button>
                                                    {b.status !== 'CANCELLED' && (
                                                        <button
                                                            className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-all"
                                                            onClick={() => cancelBooking(b.id)}
                                                            title="Annulla Prenotazione"
                                                        >
                                                            <X className="h-4 w-4 stroke-[3]" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={9} className="text-center py-20 text-gray-500">
                                            <div className="flex flex-col items-center justify-center opacity-30">
                                                <Car className="h-16 w-16 mb-4" />
                                                <p className="text-lg font-medium">Nessuna prenotazione attiva.</p>
                                                <p className="text-sm">Inizia cliccando su "Nuova Prenotazione"</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Manual Booking / Edit Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200">
                        <div className="bg-[#11355a] p-6 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold">{editingBooking ? 'Modifica Prenotazione' : 'Nuova Prenotazione Manuale'}</h3>
                                <p className="text-blue-100/70 text-xs mt-0.5">Inserisci tutti i dati richiesti per il trasferimento.</p>
                            </div>
                            <button onClick={() => setShowAddModal(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="p-8">
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
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Agenzia</label>
                                            <input className="w-full border-gray-200 rounded-xl p-3 text-sm focus:ring-primary focus:border-primary shadow-sm" placeholder="Nome agenzia (opzionale)" value={formData.agency} onChange={e => setFormData({ ...formData, agency: e.target.value })} />
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
        </div>
    );
}

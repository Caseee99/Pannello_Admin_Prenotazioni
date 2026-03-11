import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Mail, Check, X, Car, UserCheck } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Button } from '@/components/ui/button';

export default function Bookings() {
    const [drafts, setDrafts] = useState<any[]>([]);
    const [bookings, setBookings] = useState<any[]>([]);
    const [drivers, setDrivers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [draftsRes, bookingsRes, driversRes] = await Promise.all([
                api.get('/email-imports?status=PENDING_REVIEW'),
                api.get('/bookings'),
                api.get('/drivers') // Fetch drivers for assignment
            ]);
            setDrafts(draftsRes.data);
            setBookings(bookingsRes.data.filter((b: any) => b.status !== 'DRAFT'));
            setDrivers(driversRes.data.filter((d: any) => d.active));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
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
    CONFIRMED: 'Da confermare',
    ASSIGNED: 'Assegnata',
    COMPLETED: 'Completata',
    CANCELLED: 'Annullata',
};

    if (loading) return <div>Caricamento in corso...</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Gestione Prenotazioni</h2>
                <p className="text-gray-500 mt-1">Revisiona importazioni email e assegna corse in modo semplice e veloce.</p>
            </div>

            {drafts.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold flex items-center text-gray-900 border-b pb-2">
                        <Mail className="mr-2 h-5 w-5 text-yellow-500" />
                        Email da Revisionare
                    </h3>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {drafts.map((draft) => {
                            const parsedInfo = JSON.parse(draft.parsedJson || '[]');
                            return (
                                <Card key={draft.id} className="rounded-2xl border-0 shadow-md bg-white overflow-hidden relative group">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                                        <Mail className="h-20 w-20 text-yellow-500" />
                                    </div>
                                    <CardHeader className="bg-yellow-50/50 border-b border-yellow-100">
                                        <CardTitle className="text-sm font-semibold text-yellow-800">Importazione {new Date(draft.createdAt).toLocaleDateString()}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-4 text-xs h-24 overflow-y-auto text-gray-400">
                                        {draft.rawContent.substring(0, 150)}...
                                    </CardContent>
                                    <CardContent className="pt-0 space-y-3 pb-4">
                                        {parsedInfo.map((b: any, index: number) => (
                                            <div key={index} className="border border-gray-100 p-3 rounded-xl bg-gray-50/50 text-sm shadow-sm">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="font-bold text-gray-700">{b.pickupDateTime?.substring(0, 16).replace('T', ' ')}</span>
                                                    <span className="bg-white px-2 py-0.5 rounded-full text-xs font-medium border text-gray-500">{b.passengersCount} Pax</span>
                                                </div>
                                                <p className="text-gray-600 truncate">{b.origin} ➔ {b.destination}</p>
                                                <p className="text-gray-500 text-xs mt-1">{b.passengerName} ({b.passengerPhone})</p>
                                                {b.notes && <p className="text-red-500 text-xs mt-2 bg-red-50 p-2 rounded-lg"><strong>Info:</strong> {b.notes}</p>}
                                            </div>
                                        ))}

                                        <div className="flex space-x-2 pt-2">
                                            <Button size="sm" className="w-full bg-primary hover:bg-primary/90 rounded-xl" onClick={async () => {
                                                try {
                                                    await api.patch(`/email-imports/${draft.id}/confirm`);
                                                    fetchData();
                                                } catch (e) {
                                                    console.error(e);
                                                    alert('Errore compilazione prenotazioni');
                                                }
                                            }}>
                                                <Check className="mr-2 h-4 w-4" /> Conferma Tutte
                                            </Button>
                                            <Button size="sm" variant="outline" className="rounded-xl border-red-200 text-red-600 hover:bg-red-50" onClick={async () => {
                                                if (!confirm('Sicuro di voler scartare questa email?')) return;
                                                try {
                                                    await api.patch(`/email-imports/${draft.id}/discard`);
                                                    fetchData();
                                                } catch (e) {
                                                    console.error(e);
                                                }
                                            }}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="space-y-6">
                
                {/* Simulated Filters Box - Visual matching Alonak */}
                <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-6 hidden md:block">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Filtri</p>
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <label className="block text-xs text-gray-500 mb-1">Stato</label>
                            <select className="w-full border border-gray-200 rounded-lg p-2 text-sm text-gray-700 bg-white"><option>Tutti</option></select>
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs text-gray-500 mb-1">Autista</label>
                            <select className="w-full border border-gray-200 rounded-lg p-2 text-sm text-gray-700 bg-white"><option>Tutti</option></select>
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs text-gray-500 mb-1">Partenza</label>
                            <select className="w-full border border-gray-200 rounded-lg p-2 text-sm text-gray-700 bg-white"><option>Tutte</option></select>
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs text-gray-500 mb-1">Destinazione</label>
                            <select className="w-full border border-gray-200 rounded-lg p-2 text-sm text-gray-700 bg-white"><option>Tutte</option></select>
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs text-gray-500 mb-1">Da data</label>
                            <input type="date" className="w-full border border-gray-200 rounded-lg p-2 text-sm text-gray-700 bg-white" />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs text-gray-500 mb-1">A data</label>
                            <input type="date" className="w-full border border-gray-200 rounded-lg p-2 text-sm text-gray-700 bg-white" />
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-gray-100 shadow-sm bg-white overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-gray-400 text-xs font-medium border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 font-normal">Data/Ora</th>
                                    <th className="px-6 py-4 font-normal">Tratta</th>
                                    <th className="px-4 py-4 font-normal w-16">Pax</th>
                                    <th className="px-6 py-4 font-normal">Passeggero</th>
                                    <th className="px-6 py-4 font-normal">Autista</th>
                                    <th className="px-6 py-4 font-normal">Stato</th>
                                    <th className="px-6 py-4 font-normal">Tariffa</th>
                                    <th className="px-6 py-4 font-normal">Azioni</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {bookings.length > 0 ? bookings.map((b) => (
                                    <tr key={b.id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-6 py-5 whitespace-nowrap text-gray-900 font-medium font-sans">
                                                {new Date(b.pickupAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })} <span className="text-gray-500 ml-1">{new Date(b.pickupAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
                                            </td>
                                            <td className="px-6 py-5 text-gray-700 whitespace-nowrap">
                                                <span className="font-medium text-gray-700">{b.origin?.name || '---'}</span>
                                                <span className="mx-2 text-gray-300">→</span>
                                                <span className="font-medium text-gray-700">{b.destination?.name || '---'}</span>
                                            </td>
                                            <td className="px-4 py-5 text-gray-800 text-center font-medium">
                                                {b.passengers || 1}
                                            </td>
                                            <td className="px-6 py-5 text-gray-800 font-medium">
                                                {b.passengerName}
                                            </td>
                                            <td className="px-6 py-5">
                                                {b.driver ? (
                                                    <span className="text-gray-800 font-medium">{b.driver.name}</span>
                                                ) : (
                                                    <span className="text-gray-400">---</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className={`inline-flex items-center px-3 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full ${STATUS_COLORS[b.status] || 'bg-gray-100 text-gray-600'}`}>
                                                    {STATUS_LABELS[b.status] || b.status}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-gray-800 font-semibold">
                                                €18.00 {/* Placeholder per abbinamento UI */}
                                            </td>
                                            <td className="px-6 py-5 whitespace-nowrap text-right">
                                                <div className="flex items-center gap-4">
                                                    {!b.driver && b.status !== 'CANCELLED' && (
                                                        <div className="flex items-center">
                                                            <UserCheck className="h-4 w-4 text-gray-400 mr-1" />
                                                            <select
                                                                className="text-sm bg-transparent font-medium text-gray-700 outline-none hover:text-[#11355a] transition-all cursor-pointer appearance-none"
                                                                value={b.driverId || ''}
                                                                onChange={async (e) => {
                                                                    const driverId = e.target.value;
                                                                    if (!driverId) return;
                                                                    try {
                                                                        await api.patch(`/bookings/${b.id}`, { driverId });
                                                                        fetchData();
                                                                    } catch (err) {
                                                                        console.error(err);
                                                                    }
                                                                }}
                                                            >
                                                                <option value="">Assegna</option>
                                                                {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                                            </select>
                                                        </div>
                                                    )}
                                                    {b.status !== 'CANCELLED' && (
                                                        <button
                                                            className="flex items-center text-sm font-medium text-red-500 hover:text-red-700 transition-colors"
                                                            onClick={() => cancelBooking(b.id)}
                                                        >
                                                            <X className="h-4 w-4 mr-1 stroke-[3]" /> Annulla
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={6} className="text-center py-12 text-gray-500">
                                            <div className="flex flex-col items-center justify-center">
                                                <Car className="h-12 w-12 text-gray-200 mb-2" />
                                                <p className="font-medium text-gray-400">Nessuna corsa attiva trovata.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Mail, Check, X, Car } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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

    useEffect(() => {
        fetchData();
    }, []);

    const getStatusBadgeColor = (status: string) => {
        switch (status) {
            case 'CONFIRMED': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            case 'ASSIGNED': return 'bg-blue-100 text-blue-800 border-blue-300';
            case 'COMPLETED': return 'bg-green-100 text-green-800 border-green-300';
            case 'CANCELLED': return 'bg-red-100 text-red-800 border-red-300';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    if (loading) return <div>Caricamento in corso...</div>;

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Gestione Prenotazioni</h2>
                <p className="text-muted-foreground">Revisiona importazioni email e assegna corse.</p>
            </div>

            {drafts.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold flex items-center">
                        <Mail className="mr-2 h-5 w-5 text-yellow-500" />
                        Email da Revisionare
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2">
                        {drafts.map((draft) => {
                            const parsedInfo = JSON.parse(draft.parsedJson || '[]');
                            return (
                                <Card key={draft.id} className="border-yellow-200">
                                    <CardHeader className="bg-yellow-50">
                                        <CardTitle className="text-sm font-medium">Email Importata - {new Date(draft.createdAt).toLocaleString()}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="pt-4 text-sm max-h-40 overflow-y-auto bg-gray-50 border-b">
                                        <pre className="whitespace-pre-wrap text-xs">{draft.rawContent.substring(0, 300)}...</pre>
                                    </CardContent>
                                    <CardContent className="pt-4 space-y-4">
                                        {parsedInfo.map((b: any, index: number) => (
                                            <div key={index} className="border p-3 rounded-md bg-white text-sm">
                                                <p><strong>Data/Ora:</strong> {b.pickupDateTime}</p>
                                                <p><strong>Tratta:</strong> {b.origin} ➔ {b.destination}</p>
                                                <p><strong>Passeggeri:</strong> {b.passengersCount}</p>
                                                <p><strong>Cliente:</strong> {b.passengerName} ({b.passengerPhone})</p>
                                                {b.notes && <p className="text-red-500"><strong>Note LLM:</strong> {b.notes}</p>}
                                            </div>
                                        ))}

                                        <div className="flex space-x-2 pt-2">
                                            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => alert('Mock Approve')}>
                                                <Check className="mr-2 h-4 w-4" /> Conferma Tutte
                                            </Button>
                                            <Button size="sm" variant="destructive" onClick={() => alert('Mock Reject')}>
                                                <X className="mr-2 h-4 w-4" /> Scarta
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="space-y-4">
                <h3 className="text-xl font-semibold flex items-center">
                    <Car className="mr-2 h-5 w-5 text-blue-500" />
                    Calendario Corse
                </h3>

                <div className="rounded-md border bg-white shadow-sm overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-700 uppercase">
                            <tr>
                                <th className="px-6 py-3 font-medium">Data / Ora</th>
                                <th className="px-6 py-3 font-medium">Tratta</th>
                                <th className="px-6 py-3 font-medium">Cliente</th>
                                <th className="px-6 py-3 font-medium">Stato</th>
                                <th className="px-6 py-3 font-medium">Autista</th>
                                <th className="px-6 py-3 font-medium text-right">Azioni</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bookings.length > 0 ? bookings.map((b) => (
                                <tr key={b.id} className="border-b hover:bg-gray-50 bg-white">
                                    <td className="px-6 py-4 whitespace-nowrap">{new Date(b.pickupAt).toLocaleString()}</td>
                                    <td className="px-6 py-4">{b.origin?.name || 'Inconnu'} ➔ {b.destination?.name || 'Inconnu'}</td>
                                    <td className="px-6 py-4">{b.passengerName} <br /><span className="text-xs text-gray-500">{b.passengerPhone}</span></td>
                                    <td className="px-6 py-4">
                                        <Badge variant="outline" className={getStatusBadgeColor(b.status)}>{b.status}</Badge>
                                    </td>
                                    <td className="px-6 py-4 font-semibold text-blue-800">
                                        {b.driver ? b.driver.name : <span className="text-red-500">Da assegnare</span>}
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        {!b.driver && b.status !== 'CANCELLED' && (
                                            <select
                                                className="text-sm border rounded p-1 mr-2 bg-gray-50"
                                                title="Seleziona Autista"
                                                onChange={(e) => {
                                                    if (e.target.value) alert(`Assegnazione autista ID ${e.target.value} alla corsa ${b.id} simulata`);
                                                }}
                                            >
                                                <option value="">-- Seleziona Autista --</option>
                                                {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                            </select>
                                        )}
                                        {b.driver && b.status === 'ASSIGNED' && (
                                            <Button
                                                size="sm"
                                                className="bg-[#25D366] hover:bg-[#128C7E] text-white"
                                                title="Invia WhatsApp all'autista"
                                                onClick={() => {
                                                    const datetime = new Date(b.pickupAt).toLocaleString();
                                                    const text = `Ciao ${b.driver.name},\nTi assegno questo transfer:\n📅 ${datetime}\n📍 Da: ${b.origin?.name}\n🏁 A: ${b.destination?.name}\n👥 Pax: ${b.passengers}\n👤 Nome: ${b.passengerName} (${b.passengerPhone || 'N/A'})\n📝 Note: ${b.notes || 'Nessuna'}`;
                                                    const url = `https://wa.me/${b.driver.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`;
                                                    window.open(url, '_blank');
                                                }}
                                            >
                                                WhatsApp
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-gray-500">Nessuna corsa attiva trovata.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

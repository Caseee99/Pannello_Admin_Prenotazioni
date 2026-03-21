import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, DollarSign, PlusCircle, Loader2, Mail } from 'lucide-react';

export default function Settings() {
    const [locations, setLocations] = useState<any[]>([]);
    const [fares, setFares] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [smtpStatus, setSmtpStatus] = useState<any>(null);

    const [showAddFareModal, setShowAddFareModal] = useState(false);
    const [newFare, setNewFare] = useState({ originId: '', destinationId: '', amount: '' });

    useEffect(() => {
        loadSettings();
    }, []);

    async function checkSmtp() {
        try {
            const res = await api.get('/bookings/smtp-check');
            setSmtpStatus(res.data);
        } catch (e: any) {
            setSmtpStatus({ error: e.response?.data || e.message });
        }
    }

    async function sendTestEmail() {
        const to = prompt("Inserisci l'email a cui inviare il test:");
        if (!to) return;
        try {
            setSmtpStatus({ message: "Invio in corso..." });
            const res = await api.post('/bookings/test-email', { to });
            setSmtpStatus(res.data);
            alert("Email di test inviata!");
        } catch (e: any) {
            setSmtpStatus({ error: e.response?.data || e.message });
            alert("Errore durante l'invio del test");
        }
    }

    async function loadSettings() {
        try {
            const [locRes, fareRes] = await Promise.all([
                api.get('/locations'),
                api.get('/fares')
            ]);
            setLocations(locRes.data);
            setFares(fareRes.data);
        } catch (e) {
            console.error("Errore caricamento impostazioni", e);
        } finally {
            setLoading(false);
        }
    }

    const handleAddFare = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newFare.originId || !newFare.destinationId || !newFare.amount) return;
        try {
            await api.post('/fares', {
                originId: newFare.originId,
                destinationId: newFare.destinationId,
                amount: parseFloat(newFare.amount)
            });
            setShowAddFareModal(false);
            setNewFare({ originId: '', destinationId: '', amount: '' });
            loadSettings();
        } catch (err) {
            console.error(err);
            alert("Errore inserimento tariffa");
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <Loader2 className="h-10 w-10 text-[#11355a] animate-spin" />
                <p className="text-gray-500 font-medium italic">Caricamento in corso...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Impostazioni Sistema</h2>
                <p className="text-muted-foreground">Gestisci i punti d'interesse e le tariffe predefinite.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Locations Settings */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 bg-gray-50 border-b">
                        <CardTitle className="text-lg font-medium flex items-center">
                            <MapPin className="mr-2 h-5 w-5 text-red-500" />
                            Locations (Scali)
                        </CardTitle>
                        <Button size="sm" variant="outline" className="h-8 gap-1" onClick={async () => {
                            const name = prompt("Nome scalo (es. Stazione Centrale):");
                            if (!name) return;
                            const type = prompt("Tipo (HUB, PORT, AIRPORT, CUSTOM):", "CUSTOM");
                            if (!type) return;
                            try {
                                await api.post('/locations', { name, type, active: true });
                                loadSettings();
                            } catch (e) {
                                alert("Errore");
                            }
                        }}>
                            <PlusCircle className="h-4 w-4" /> Nuovo
                        </Button>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <ul className="space-y-3">
                            {locations.map((loc) => (
                                <li key={loc.id} className="flex justify-between items-center text-sm border-b pb-2 last:border-0 last:pb-0">
                                    <div className="font-medium">{loc.name}</div>
                                    <Badge variant="secondary" className="text-xs">{loc.type}</Badge>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>

                {/* Fares Settings */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 bg-gray-50 border-b">
                        <CardTitle className="text-lg font-medium flex items-center">
                            <DollarSign className="mr-2 h-5 w-5 text-green-600" />
                            Tariffe
                        </CardTitle>
                        <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setShowAddFareModal(true)}>
                            <PlusCircle className="h-4 w-4" /> Nuova
                        </Button>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <ul className="space-y-3">
                            {fares.length === 0 && <li className="text-sm text-gray-500">Nessuna tariffa configurata.</li>}
                            {fares.map((fare) => (
                                <li key={fare.id} className="flex flex-col text-sm border-b pb-3 last:border-0 last:pb-0">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-medium text-gray-700">
                                            {fare.origin.name} ➔ {fare.destination.name}
                                        </span>
                                        <span className="font-bold text-green-700">€{fare.amount}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            </div>

            {/* Add Fare Modal */}
            {showAddFareModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-semibold mb-4">Aggiungi / Modifica Tariffa</h3>
                        <form onSubmit={handleAddFare} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Partenza</label>
                                <select 
                                    required 
                                    className="w-full border rounded p-2" 
                                    value={newFare.originId} 
                                    onChange={e => setNewFare({ ...newFare, originId: e.target.value })}
                                    title="Punto di partenza"
                                >
                                    <option value="">Seleziona...</option>
                                    {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Arrivo</label>
                                <select 
                                    required 
                                    className="w-full border rounded p-2" 
                                    value={newFare.destinationId} 
                                    onChange={e => setNewFare({ ...newFare, destinationId: e.target.value })}
                                    title="Punto di arrivo"
                                >
                                    <option value="">Seleziona...</option>
                                    {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Importo (€)</label>
                                <input 
                                    required 
                                    type="number" 
                                    step="0.5" 
                                    className="w-full border rounded p-2" 
                                    value={newFare.amount} 
                                    onChange={e => setNewFare({ ...newFare, amount: e.target.value })} 
                                    placeholder="Importo (€)"
                                    title="Importo (€)"
                                />
                            </div>
                            <div className="flex justify-end space-x-2 pt-4">
                                <Button type="button" variant="outline" onClick={() => setShowAddFareModal(false)}>Annulla</Button>
                                <Button type="submit">Salva</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Email Diagnostics */}
            <Card>
                <CardHeader className="bg-gray-50 border-b">
                    <CardTitle className="text-lg font-medium flex items-center">
                        <Mail className="mr-2 h-5 w-5 text-blue-600" />
                        Diagnostica Email (SMTP)
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" onClick={checkSmtp}>Verifica Configurazione</Button>
                        <Button variant="outline" onClick={sendTestEmail}>Invia Email di Test</Button>
                    </div>
                    {smtpStatus && (
                        <div className="p-4 bg-gray-50 rounded-lg text-xs font-mono whitespace-pre-wrap border overflow-auto max-h-64">
                            {JSON.stringify(smtpStatus, null, 2)}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

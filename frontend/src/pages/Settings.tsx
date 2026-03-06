import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, DollarSign, PlusCircle } from 'lucide-react';

export default function Settings() {
    const [locations, setLocations] = useState<any[]>([]);
    const [fares, setFares] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
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
        loadSettings();
    }, []);

    if (loading) return <div>Caricamento in corso...</div>;

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
                        <Button size="sm" variant="outline" className="h-8 gap-1">
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
                        <Button size="sm" variant="outline" className="h-8 gap-1">
                            <PlusCircle className="h-4 w-4" /> Nuova
                        </Button>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <ul className="space-y-3">
                            {fares.map((fare) => (
                                <li key={fare.id} className="flex flex-col text-sm border-b pb-3 last:border-0 last:pb-0">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-medium text-gray-700">
                                            {fare.origin.name} ➔ {fare.destination.name}
                                        </span>
                                        <span className="font-bold text-green-700">€{fare.price}</span>
                                    </div>
                                    {(fare.priceExtraPax || fare.priceNight) && (
                                        <div className="text-xs text-muted-foreground flex space-x-3">
                                            {fare.priceExtraPax && <span>Extra PAX: €{fare.priceExtraPax}</span>}
                                            {fare.priceNight && <span>Notturno: €{fare.priceNight}</span>}
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            </div>

        </div>
    );
}

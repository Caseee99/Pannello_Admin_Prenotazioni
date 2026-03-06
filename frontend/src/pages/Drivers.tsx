import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Phone, Settings } from 'lucide-react';

export default function Drivers() {
    const [drivers, setDrivers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchDrivers() {
            try {
                const res = await api.get('/drivers');
                setDrivers(res.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        fetchDrivers();
    }, []);

    if (loading) return <div>Caricamento in corso...</div>;

    return (
        <div className="space-y-6">
            <div className="sm:flex sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Gestione Autisti</h2>
                    <p className="text-muted-foreground">Anagrafica soci e disponibilità settimanale.</p>
                </div>
                <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
                    <Button className="flex items-center">
                        <UserPlus className="mr-2 h-4 w-4" />
                        Aggiungi Autista
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {drivers.map(driver => (
                    <Card key={driver.id}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-lg font-medium">{driver.name}</CardTitle>
                            {driver.active ? (
                                <Badge className="bg-green-100 text-green-800 border-green-300 pointer-events-none">Attivo</Badge>
                            ) : (
                                <Badge variant="outline" className="text-red-600 border-red-300">Inattivo</Badge>
                            )}
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center text-sm text-gray-500 mb-4">
                                <Phone className="mr-2 h-4 w-4" />
                                {driver.phone}
                            </div>

                            <div className="border-t pt-4">
                                <div className="text-xs font-semibold mb-2 flex justify-between">
                                    <span>Disponibilità Mese:</span>
                                    <Settings className="h-4 w-4 text-gray-400 cursor-pointer hover:text-gray-700" onClick={() => alert('Modifica disponibilità')} />
                                </div>
                                {/* Mock display of availability from the latest record */}
                                {driver.availabilities && driver.availabilities.length > 0 ? (
                                    <div className="flex justify-between gap-1 text-xs">
                                        {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((day, idx) => {
                                            const mapKey = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][idx];
                                            const isAvail = driver.availabilities[0][mapKey];
                                            return (
                                                <div key={idx} className={`w-6 h-6 rounded flex items-center justify-center font-medium ${isAvail ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                                                    {day}
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-xs text-gray-400">Non configurata</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}

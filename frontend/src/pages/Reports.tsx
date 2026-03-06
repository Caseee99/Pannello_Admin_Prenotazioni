import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ReceiptText, Download } from 'lucide-react';

export default function Reports() {
    const [completedBookings, setCompletedBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchReports() {
            try {
                const res = await api.get('/bookings?status=COMPLETED');
                setCompletedBookings(res.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        fetchReports();
    }, []);

    if (loading) return <div>Caricamento in corso...</div>;

    // Simple aggregation for UI
    const driverStats: Record<string, { count: number, revenue: number }> = {};
    completedBookings.forEach(b => {
        const driverName = b.driver?.name || 'Sconosciuto';
        if (!driverStats[driverName]) {
            driverStats[driverName] = { count: 0, revenue: 0 };
        }
        driverStats[driverName].count += 1;
        const fare = b.fare?.price || 18; // fallback mock se assente
        driverStats[driverName].revenue += fare;
    });

    return (
        <div className="space-y-6">
            <div className="sm:flex sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Report e Pagamenti</h2>
                    <p className="text-muted-foreground">Amministrazione finanziaria e riepilogo per autista.</p>
                </div>
                <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none space-x-2">
                    <Button variant="outline" className="flex items-center">
                        <Download className="mr-2 h-4 w-4" />
                        Esporta Excel
                    </Button>
                    <Button className="flex items-center bg-red-600 hover:bg-red-700">
                        <Download className="mr-2 h-4 w-4" />
                        Scarica PDF Mensile
                    </Button>
                </div>
            </div>

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
                                        <div className="text-right">
                                            <span className="font-bold text-lg text-green-700">€ {stats.revenue.toFixed(2)}</span>
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

            <div>
                <h3 className="text-lg font-medium mb-4">Ultimi Movimenti</h3>
                <div className="rounded-md border bg-white shadow-sm overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-700 uppercase">
                            <tr>
                                <th className="px-6 py-3 font-medium">Data</th>
                                <th className="px-6 py-3 font-medium">Autista</th>
                                <th className="px-6 py-3 font-medium">Tratta</th>
                                <th className="px-6 py-3 font-medium">Importo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {completedBookings.length > 0 ? completedBookings.map((b) => (
                                <tr key={b.id} className="border-b hover:bg-gray-50 bg-white">
                                    <td className="px-6 py-4 whitespace-nowrap">{new Date(b.pickupAt).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 font-medium">{b.driver?.name || 'Sconosciuto'}</td>
                                    <td className="px-6 py-4">{b.origin?.name} ➔ {b.destination?.name}</td>
                                    <td className="px-6 py-4 font-bold text-green-700">€{b.fare?.price || '18'}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={4} className="text-center py-6 text-gray-500">Nessun dato cronologico.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

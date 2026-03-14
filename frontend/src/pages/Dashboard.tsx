import { useEffect, useState, useMemo } from 'react';
import { BookOpen, CalendarDays, ChevronLeft, ChevronRight, MapPin, Users, Clock, Car, TrendingUp, PieChart as PieChartIcon } from 'lucide-react';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AnalyticsChart from '../components/AnalyticsChart';
import DistributionChart from '../components/DistributionChart';

const STATUS_COLORS: Record<string, string> = {
    CONFIRMED: 'bg-amber-100 text-amber-800 border-amber-300',
    ASSIGNED: 'bg-blue-100 text-blue-800 border-blue-300',
    COMPLETED: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    CANCELLED: 'bg-red-100 text-red-800 border-red-300',
};

function formatDate(d: Date): string {
    return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function addDays(d: Date, n: number): Date {
    const result = new Date(d);
    result.setDate(result.getDate() + n);
    return result;
}

export default function Dashboard() {
    const role = typeof window !== 'undefined' ? localStorage.getItem('role') : null;

    if (role === 'agency') {
        window.location.href = '/bookings';
        return null;
    }
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [allBookings, setAllBookings] = useState<any[]>([]);
    const [drivers, setDrivers] = useState<any[]>([]);
    const [drafts, setDrafts] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [allRes, draftsRes, driversRes] = await Promise.all([
                    api.get('/bookings'),
                    api.get('/email-imports?status=PENDING_REVIEW'),
                    api.get('/drivers'),
                ]);
                setAllBookings(allRes.data || []);
                setDrafts(draftsRes.data?.length || 0);
                setDrivers(driversRes.data || []);
            } catch (e) {
                console.error('Errore dashboard:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const analyticsData = useMemo(() => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const currentYear = new Date().getFullYear();
        const counts = Array(12).fill(0);

        allBookings.forEach(b => {
            const d = new Date(b.pickupAt);
            if (d.getFullYear() === currentYear && b.status !== 'CANCELLED') {
                counts[d.getMonth()]++;
            }
        });

        return months.map((name, i) => ({ name, count: counts[i] }));
    }, [allBookings]);

    const distributionData = useMemo(() => {
        const stats: Record<string, number> = {};
        allBookings.filter(b => b.status !== 'CANCELLED').forEach(b => {
            const status = b.status || 'UNKNOWN';
            stats[status] = (stats[status] || 0) + 1;
        });

        return Object.entries(stats).map(([name, value]) => ({ name, value }));
    }, [allBookings]);

    const dayBookings = allBookings.filter((b: any) => {
        if (b.status === 'CANCELLED') return false;
        const bDate = new Date(b.pickupAt);
        return bDate.getFullYear() === selectedDate.getFullYear() &&
               bDate.getMonth() === selectedDate.getMonth() &&
               bDate.getDate() === selectedDate.getDate();
    }).sort((a: any, b: any) => new Date(a.pickupAt).getTime() - new Date(b.pickupAt).getTime());

    const dayAssigned = dayBookings.filter((b: any) => b.status === 'ASSIGNED').length;
    const dayUnassigned = dayBookings.filter((b: any) => b.status === 'CONFIRMED' && !b.driverId).length;
    const activeBookings = allBookings.filter((b: any) => b.status !== 'CANCELLED');

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-extrabold tracking-tight text-gray-900">Dashboard</h2>
                    <p className="text-gray-500 mt-1">Benvenuto nella tua console di gestione trasporti.</p>
                </div>
                {drafts > 0 && (
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-4 py-2 rounded-2xl shadow-sm">
                        <BookOpen className="h-4 w-4 text-amber-600" />
                        <span className="text-sm font-semibold text-amber-800">{drafts} email da gestire</span>
                        <Button variant="ghost" size="sm" className="h-7 text-xs font-bold text-amber-700 hover:bg-amber-100 ml-2" onClick={() => window.location.href='/bookings'}>
                            Vedi →
                        </Button>
                    </div>
                )}
            </div>

            {/* KPI Cards section */}
            <div className="grid gap-6 md:grid-cols-4">
                <Card className="rounded-[2rem] border-0 shadow-xl shadow-blue-900/5 bg-[#eef6ff]">
                    <CardContent className="p-7">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-blue-500/10 rounded-2xl">
                                <TrendingUp className="h-6 w-6 text-blue-600" />
                            </div>
                        </div>
                        <p className="text-sm font-bold text-blue-900/60 uppercase tracking-widest">Totali Attive</p>
                        <h3 className="text-4xl font-black text-blue-950 mt-1">{activeBookings.length}</h3>
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-0 shadow-xl shadow-amber-900/5 bg-[#fffaf0]">
                    <CardContent className="p-7">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-amber-500/10 rounded-2xl">
                                <Clock className="h-6 w-6 text-amber-600" />
                            </div>
                        </div>
                        <p className="text-sm font-bold text-amber-900/60 uppercase tracking-widest">In Attesa</p>
                        <h3 className="text-4xl font-black text-amber-950 mt-1">
                            {activeBookings.filter(b => b.status === 'CONFIRMED').length}
                        </h3>
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-0 shadow-xl shadow-purple-900/5 bg-[#fdf4ff]">
                    <CardContent className="p-7">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-purple-500/10 rounded-2xl">
                                <Car className="h-6 w-6 text-purple-600" />
                            </div>
                        </div>
                        <p className="text-sm font-bold text-purple-900/60 uppercase tracking-widest">Assegnate</p>
                        <h3 className="text-4xl font-black text-purple-950 mt-1">
                            {activeBookings.filter(b => b.status === 'ASSIGNED').length}
                        </h3>
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-0 shadow-xl shadow-emerald-900/5 bg-[#f0fdf4]">
                    <CardContent className="p-7">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-emerald-500/10 rounded-2xl">
                                <Users className="h-6 w-6 text-emerald-600" />
                            </div>
                        </div>
                        <p className="text-sm font-bold text-emerald-900/60 uppercase tracking-widest">Tutto il mese</p>
                        <h3 className="text-4xl font-black text-emerald-950 mt-1">
                            {activeBookings.filter(b => {
                                const d = new Date(b.pickupAt);
                                return d.getMonth() === new Date().getMonth();
                            }).length}
                        </h3>
                    </CardContent>
                </Card>
            </div>

            {/* Charts section */}
            <div className="grid gap-6 lg:grid-cols-2">
                <Card className="rounded-[2rem] border-0 shadow-xl shadow-gray-200/50 bg-white overflow-hidden p-6">
                    <div className="flex items-center justify-between mb-6">
                        <CardTitle className="text-xl font-bold text-gray-900">Andamento Corse 2026</CardTitle>
                        <div className="bg-gray-50 px-3 py-1 rounded-full text-[10px] font-bold text-gray-400 uppercase tracking-widest">Anno Corrente</div>
                    </div>
                    <AnalyticsChart data={analyticsData} />
                </Card>

                <Card className="rounded-[2rem] border-0 shadow-xl shadow-gray-200/50 bg-white overflow-hidden p-6">
                    <div className="flex items-center justify-between mb-6">
                        <CardTitle className="text-xl font-bold text-gray-900">Distribuzione Stati</CardTitle>
                        <PieChartIcon className="h-5 w-5 text-gray-300" />
                    </div>
                    <DistributionChart data={distributionData} />
                </Card>
            </div>

            {/* Daily bookings section */}
            <Card className="rounded-[2.5rem] border-0 shadow-2xl shadow-gray-200/50 bg-white overflow-hidden">
                <CardHeader className="p-8 border-b border-gray-50 bg-gray-50/30">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <CardTitle className="text-2xl font-black text-gray-900 flex items-center gap-2">
                                <CalendarDays className="h-7 w-7 text-blue-600" />
                                Corse di Oggi
                            </CardTitle>
                            <p className="text-gray-400 text-sm font-medium mt-1 uppercase tracking-widest">{formatDate(selectedDate)}</p>
                        </div>
                        <div className="flex items-center gap-3 bg-white p-2 rounded-[1.5rem] shadow-sm border border-gray-100">
                            <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full bg-gray-50" onClick={() => setSelectedDate(d => addDays(d, -1))}>
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                            <Button variant="ghost" className="text-sm font-bold px-5 text-gray-600 hover:bg-gray-50" onClick={() => setSelectedDate(new Date())}>Oggi</Button>
                            <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full bg-gray-50" onClick={() => setSelectedDate(d => addDays(d, 1))}>
                                <ChevronRight className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {dayBookings.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-300">
                            <CalendarDays className="h-20 w-20 mb-4 opacity-10" />
                            <p className="text-lg font-medium">Nessuna corse per questa data</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-gray-50/30 text-gray-400 text-[10px] font-bold uppercase tracking-[0.2em]">
                                        <th className="px-8 py-4">Ora</th>
                                        <th className="px-8 py-4">Passeggero</th>
                                        <th className="px-8 py-4">Tratta</th>
                                        <th className="px-8 py-4">Stato</th>
                                        <th className="px-8 py-4">Info</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {dayBookings.map((b: any) => (
                                        <tr key={b.id} className="hover:bg-blue-50/30 transition-colors group">
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
                                                        <Clock className="h-4 w-4 text-blue-600" />
                                                    </div>
                                                    <span className="text-lg font-black text-gray-900">
                                                        {new Date(b.pickupAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <p className="font-bold text-gray-950 text-base">{b.passengerName}</p>
                                                <p className="text-xs text-gray-400 mt-0.5">{b.passengerPhone || 'Nessun telefono'}</p>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-2">
                                                    <div className="max-w-[200px] truncate font-medium text-gray-700">{b.origin?.name || b.originRaw}</div>
                                                    <span className="text-gray-300">→</span>
                                                    <div className="max-w-[200px] truncate font-medium text-gray-700">{b.destination?.name || b.destinationRaw}</div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <Badge className={`rounded-xl px-4 py-1.5 font-bold text-[10px] border-0 shadow-sm ${STATUS_COLORS[b.status]}`}>
                                                    {b.status}
                                                </Badge>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col gap-1">
                                                    {b.driver ? (
                                                        <div className="flex items-center gap-2 text-xs font-bold text-blue-600">
                                                            <Car className="h-3.5 w-3.5" />
                                                            {b.driver.name}
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2 text-xs font-bold text-amber-500">
                                                            <Users className="h-3.5 w-3.5" />
                                                            Da assegnare
                                                        </div>
                                                    )}
                                                    <span className="text-[10px] text-gray-400 font-medium italic">{b.agency || 'Privato'}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

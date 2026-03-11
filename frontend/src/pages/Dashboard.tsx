import { useEffect, useState } from 'react';
import { BookOpen, UserCheck, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, MapPin, Users, Clock, Car } from 'lucide-react';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const STATUS_COLORS: Record<string, string> = {
    CONFIRMED: 'bg-amber-100 text-amber-800 border-amber-300',
    ASSIGNED: 'bg-blue-100 text-blue-800 border-blue-300',
    COMPLETED: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    CANCELLED: 'bg-red-100 text-red-800 border-red-300',
};

const DRIVER_BADGE_COLORS = [
    'bg-violet-100 text-violet-800',
    'bg-cyan-100 text-cyan-800',
    'bg-pink-100 text-pink-800',
    'bg-lime-100 text-lime-800',
    'bg-orange-100 text-orange-800',
    'bg-teal-100 text-teal-800',
];

function formatDate(d: Date): string {
    return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function toISO(d: Date): string {
    return d.toISOString().split('T')[0];
}
function addDays(d: Date, n: number): Date {
    const result = new Date(d);
    result.setDate(result.getDate() + n);
    return result;
}

export default function Dashboard() {
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

    // Bookings for the selected day
    const dayStr = toISO(selectedDate);
    const dayBookings = allBookings.filter((b: any) => {
        return b.status !== 'CANCELLED' && toISO(new Date(b.pickupAt)) === dayStr;
    }).sort((a: any, b: any) => new Date(a.pickupAt).getTime() - new Date(b.pickupAt).getTime());

    // Stats for selected day
    const dayAssigned = dayBookings.filter((b: any) => b.status === 'ASSIGNED').length;
    const dayUnassigned = dayBookings.filter((b: any) => b.status === 'CONFIRMED' && !b.driverId).length;

    // Global stats
    const activeBookings = allBookings.filter((b: any) => b.status !== 'CANCELLED');
    const totalAssigned = activeBookings.filter((b: any) => b.status === 'ASSIGNED').length;

    // Driver assignments (all non-cancelled assigned bookings, grouped by driver)
    const driverMap: Record<string, { driver: any; bookings: any[] }> = {};
    allBookings.forEach((b: any) => {
        if (b.status === 'ASSIGNED' && b.driver) {
            const key = b.driver.id;
            if (!driverMap[key]) driverMap[key] = { driver: b.driver, bookings: [] };
            driverMap[key].bookings.push(b);
        }
    });
    const driverGroups = Object.values(driverMap).sort((a, b) => a.driver.name.localeCompare(b.driver.name));

    // Ungrouped drivers (no assigned bookings)
    const unassignedDrivers = drivers.filter(d => !driverMap[d.id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-gray-900">Panoramica</h2>
                <p className="text-gray-500 mt-1">Gestisci le prenotazioni e monitora le assegnazioni autisti.</p>
            </div>

            {/* Draft alert */}
            {drafts > 0 && (
                <div className="rounded-2xl border border-yellow-200 bg-yellow-50/50 p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 bg-yellow-100 p-2 rounded-full">
                            <BookOpen className="h-5 w-5 text-yellow-600" />
                        </div>
                        <p className="text-sm font-medium text-yellow-800">
                            Hai <strong>{drafts}</strong> email importate da revisionare.{' '}
                            <a href="/bookings" className="font-bold underline underline-offset-2 hover:text-yellow-900 transition-colors">Vai alle Bozze →</a>
                        </p>
                    </div>
                </div>
            )}

            {/* KPI Cards (Alonak Style) */}
            <div className="grid gap-4 md:grid-cols-4">
                {/* 1. Corse oggi (Dark Blue) */}
                <Card className="rounded-xl border-0 shadow-sm bg-[#11355a] text-white">
                    <CardContent className="p-5 flex flex-col justify-center min-h-[110px]">
                        <p className="text-sm font-medium text-blue-100/80 mb-1">Corse oggi</p>
                        <h3 className="text-4xl font-bold tracking-tight">{dayBookings.length}</h3>
                    </CardContent>
                </Card>
                
                {/* 2. Non assegnate (Slate Blue/Gray) */}
                <Card className="rounded-xl border-0 shadow-sm bg-[#8a9fb0] text-white">
                    <CardContent className="p-5 flex flex-col justify-center min-h-[110px]">
                        <p className="text-sm font-medium text-white/80 mb-1">Non assegnate</p>
                        <h3 className="text-4xl font-bold tracking-tight">
                            {activeBookings.filter((b: any) => b.status === 'CONFIRMED').length}
                        </h3>
                    </CardContent>
                </Card>

                {/* 3. Completate oggi (Emerald Green) */}
                <Card className="rounded-xl border-0 shadow-sm bg-[#22c55e] text-white">
                    <CardContent className="p-5 flex flex-col justify-center min-h-[110px]">
                        <p className="text-sm font-medium text-white/80 mb-1">Completate oggi</p>
                        <h3 className="text-4xl font-bold tracking-tight">
                            {dayBookings.filter((b: any) => b.status === 'COMPLETED').length}
                        </h3>
                    </CardContent>
                </Card>

                {/* 4. Da confermare (Amber/Yellow) */}
                <Card className="rounded-xl border-2 border-amber-200 shadow-sm bg-[#fbdca4] text-amber-900">
                    <CardContent className="p-5 flex flex-col justify-center min-h-[110px]">
                        <p className="text-sm font-medium text-amber-800/80 mb-1">Da confermare</p>
                        <h3 className="text-4xl font-bold tracking-tight">{drafts}</h3>
                    </CardContent>
                </Card>
            </div>

            {/* Main 2-column layout */}
            <div className="grid gap-6 lg:grid-cols-5">

                {/* === CALENDAR / TIMELINE SECTION (left, 3 cols) === */}
                <div className="lg:col-span-3">
                    <Card className="rounded-2xl border-0 shadow-sm bg-white">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                    <CalendarDays className="h-5 w-5 text-primary" />
                                    Calendario Prenotazioni
                                </CardTitle>
                                <div className="flex items-center gap-1">
                                    <Button
                                        size="sm" variant="ghost"
                                        className="h-8 w-8 p-0 rounded-lg hover:bg-gray-100"
                                        onClick={() => setSelectedDate(d => addDays(d, -1))}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        size="sm" variant="ghost"
                                        className="text-xs px-3 py-1 rounded-lg hover:bg-gray-100 font-medium text-gray-600"
                                        onClick={() => setSelectedDate(new Date())}
                                    >
                                        Oggi
                                    </Button>
                                    <Button
                                        size="sm" variant="ghost"
                                        className="h-8 w-8 p-0 rounded-lg hover:bg-gray-100"
                                        onClick={() => setSelectedDate(d => addDays(d, 1))}
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            <p className="text-sm text-gray-500 capitalize mt-1">{formatDate(selectedDate)}</p>
                            <div className="flex gap-3 mt-2">
                                <span className="text-xs font-medium text-gray-600">{dayBookings.length} corsa/e</span>
                                <span className="text-xs font-medium text-blue-600">• {dayAssigned} assegnate</span>
                                {dayUnassigned > 0 && <span className="text-xs font-medium text-red-500">• {dayUnassigned} da assegnare</span>}
                            </div>
                        </CardHeader>
                        <CardContent className="pt-2">
                            {dayBookings.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                    <CalendarDays className="h-12 w-12 mb-3 opacity-30" />
                                    <p className="text-sm">Nessuna prenotazione per questo giorno</p>
                                </div>
                            ) : (
                                <div className="space-y-3 mt-2">
                                    {dayBookings.map((b: any) => (
                                        <div key={b.id} className="flex items-start gap-4 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group">
                                            {/* Time bubble */}
                                            <div className="flex-shrink-0 text-center">
                                                <div className="w-14 h-14 rounded-xl bg-white shadow-sm flex flex-col items-center justify-center border border-gray-100">
                                                    <Clock className="h-3 w-3 text-gray-400 mb-0.5" />
                                                    <span className="text-sm font-bold text-gray-800">
                                                        {new Date(b.pickupAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                            {/* Booking details */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-semibold text-gray-900 text-sm">{b.passengerName}</span>
                                                    <Badge className={`text-xs border rounded-full px-2 py-0.5 ${STATUS_COLORS[b.status] || 'bg-gray-100 text-gray-700'}`}>
                                                        {b.status}
                                                    </Badge>
                                                    {b.passengers > 1 && (
                                                        <span className="flex items-center gap-1 text-xs text-gray-500">
                                                            <Users className="h-3 w-3" />{b.passengers} pax
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                                                    <MapPin className="h-3 w-3 text-primary flex-shrink-0" />
                                                    <span className="truncate">{b.origin?.name || '---'}</span>
                                                    <span className="mx-1 text-gray-300">→</span>
                                                    <span className="truncate">{b.destination?.name || '---'}</span>
                                                </div>
                                                {b.driver && (
                                                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                                                        <Car className="h-3 w-3 text-blue-500 flex-shrink-0" />
                                                        <span className="font-medium text-blue-600">{b.driver.name}</span>
                                                    </div>
                                                )}
                                                {b.notes && (
                                                    <p className="text-xs text-gray-400 mt-1 truncate">📝 {b.notes}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* === DRIVER ASSIGNMENTS SECTION (right, 2 cols) === */}
                <div className="lg:col-span-2 space-y-4">
                    <Card className="rounded-2xl border-0 shadow-sm bg-white">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                <Car className="h-5 w-5 text-primary" />
                                Autisti – Corse Assegnate
                            </CardTitle>
                            <p className="text-sm text-gray-500">{driverGroups.length} autista/i operativi</p>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {driverGroups.length === 0 && unassignedDrivers.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                                    <Car className="h-10 w-10 mb-2 opacity-30" />
                                    <p className="text-sm">Nessun autista registrato</p>
                                </div>
                            )}

                            {/* Drivers with assigned bookings */}
                            <div className="space-y-4 mt-1">
                                {driverGroups.map(({ driver, bookings }, idx) => (
                                    <div key={driver.id} className="rounded-xl bg-gray-50 p-4">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${DRIVER_BADGE_COLORS[idx % DRIVER_BADGE_COLORS.length]}`}>
                                                {driver.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-900 text-sm">{driver.name}</p>
                                                <p className="text-xs text-gray-400">{driver.phone}</p>
                                            </div>
                                            <span className="ml-auto text-xs font-bold bg-primary/10 text-primary rounded-full px-2.5 py-1">
                                                {bookings.length} corsa/e
                                            </span>
                                        </div>
                                        <div className="space-y-2">
                                            {bookings
                                                .sort((a: any, b: any) => new Date(a.pickupAt).getTime() - new Date(b.pickupAt).getTime())
                                                .map((b: any) => (
                                                    <div key={b.id} className="flex items-start gap-2 bg-white rounded-lg p-2.5 border border-gray-100">
                                                        <div className="flex-shrink-0 text-xs font-bold text-gray-500 w-12 text-center pt-0.5">
                                                            {new Date(b.pickupAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
                                                            <br />
                                                            <span className="text-primary">{new Date(b.pickupAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-semibold text-gray-800 truncate">{b.passengerName}</p>
                                                            <p className="text-xs text-gray-400 truncate">
                                                                {b.origin?.name || '---'} → {b.destination?.name || '---'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                ))}

                                {/* Drivers without bookings */}
                                {unassignedDrivers.length > 0 && (
                                    <div className="rounded-xl bg-gray-50/50 border border-dashed border-gray-200 p-3">
                                        <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">Senza corse</p>
                                        <div className="flex flex-wrap gap-2">
                                            {unassignedDrivers.map((d: any, idx: number) => (
                                                <div key={d.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${DRIVER_BADGE_COLORS[idx % DRIVER_BADGE_COLORS.length]} opacity-50`}>
                                                    {d.name.charAt(0).toUpperCase()} – {d.name}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Quick nav */}
                    <a href="/bookings" className="block">
                        <Card className="rounded-2xl border-0 shadow-sm bg-primary group cursor-pointer hover:opacity-90 transition-opacity">
                            <CardContent className="p-5 flex items-center justify-between">
                                <div>
                                    <p className="text-white/80 text-sm">Gestisci prenotazioni</p>
                                    <p className="text-white font-bold text-lg mt-0.5">Vai alla lista completa →</p>
                                </div>
                                <CalendarDays className="h-10 w-10 text-white/30 group-hover:text-white/50 transition-colors" />
                            </CardContent>
                        </Card>
                    </a>
                </div>
            </div>
        </div>
    );
}

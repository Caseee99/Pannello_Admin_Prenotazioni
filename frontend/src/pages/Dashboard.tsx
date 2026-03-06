import { useEffect, useState } from 'react';
import { BookOpen, UserCheck, CalendarDays, CheckCircle2 } from 'lucide-react';
import api from '../lib/api';

// Assuming we have Shadcn UI components installed soon
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Dashboard() {
    const [stats, setStats] = useState({
        todayTotal: 0,
        todayAssigned: 0,
        todayUnassigned: 0,
        drafts: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const today = new Date().toISOString().split('T')[0];

                const [bookingsRes, draftsRes] = await Promise.all([
                    api.get(`/bookings?date=${today}`),
                    api.get('/email-imports?status=PENDING_REVIEW')
                ]);

                const todayBookings = bookingsRes.data || [];
                const unassigned = todayBookings.filter((b: any) => b.status === 'CONFIRMED' && !b.driverId).length;
                const assigned = todayBookings.filter((b: any) => b.status === 'ASSIGNED').length;

                setStats({
                    todayTotal: todayBookings.length,
                    todayAssigned: assigned,
                    todayUnassigned: unassigned,
                    drafts: draftsRes.data?.length || 0
                });
            } catch (error) {
                console.error("Errore recupero dati dashboard", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    if (loading) return <div>Caricamento in corso...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
                <p className="text-muted-foreground">Panoramica delle corse di oggi.</p>
            </div>

            {stats.drafts > 0 && (
                <div className="rounded-lg border-l-4 border-yellow-400 bg-yellow-50 p-4 dark:bg-yellow-900/30">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <BookOpen className="h-5 w-5 text-yellow-400" aria-hidden="true" />
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-yellow-700 dark:text-yellow-200">
                                Hai {stats.drafts} nuove email importate da revisionare.{' '}
                                <a href="/bookings?view=drafts" className="font-bold underline">
                                    Vai alle DRAFTs
                                </a>
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Corse di Oggi (Totali)</CardTitle>
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.todayTotal}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Corse Assegnate</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.todayAssigned}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-red-500">Da Assegnare</CardTitle>
                        <UserCheck className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-500">{stats.todayUnassigned}</div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

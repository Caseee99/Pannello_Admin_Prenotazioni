import { useState, useEffect } from 'react';
import api from '../lib/api';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, MapPin, Clock } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
    CONFIRMED: 'bg-[#fef3c7] text-[#d97706]', // yellow
    ASSIGNED: 'bg-blue-100 text-blue-800',
    COMPLETED: 'bg-emerald-100 text-emerald-800',
    CANCELLED: 'bg-[#fee2e2] text-[#ef4444]', // red
};

export default function CalendarView() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [bookings, setBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBookings = async () => {
            setLoading(true);
            try {
                const res = await api.get('/bookings');
                setBookings(res.data || []);
            } catch (e) {
                console.error('Errore fetch bookings per calendario:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchBookings();
    }, []);

    const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (year: number, month: number) => {
        const day = new Date(year, month, 1).getDay();
        return day === 0 ? 6 : day - 1; // 0 = Lun, 6 = Dom
    };

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const numDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);

    // Genera celle del calendario (include spazi vuoti all'inizio)
    const calendarDays = Array.from({ length: startDay + numDays }, (_, i) => {
        if (i < startDay) return null;
        return i - startDay + 1;
    });

    const monthName = currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

    const handlePrevMonth = () => {
        setCurrentDate(new Date(year, month - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(year, month + 1, 1));
    };

    const handleToday = () => {
        setCurrentDate(new Date());
    };

    // Helper per trovare corse del giorno
    const getBookingsForDay = (day: number) => {
        const dayStr = new Date(year, month, day).toISOString().split('T')[0];
        return bookings.filter(b => {
            if (b.status === 'CANCELLED') return false;
            const bDate = new Date(b.pickupAt).toISOString().split('T')[0];
            return bDate === dayStr;
        }).sort((a, b) => new Date(a.pickupAt).getTime() - new Date(b.pickupAt).getTime());
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header Calendario */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-4 sm:mb-0">
                    <div className="bg-primary/10 p-2.5 rounded-xl">
                        <CalendarIcon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 capitalize leading-tight">
                            {monthName}
                        </h2>
                        <p className="text-sm text-gray-500">Panoramica mensile delle corse</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleToday}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        Oggi
                    </button>
                    <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200">
                        <button
                            onClick={handlePrevMonth}
                            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-l-lg transition-colors"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                        <div className="w-px h-5 bg-gray-200"></div>
                        <button
                            onClick={handleNextMonth}
                            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-r-lg transition-colors"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64 bg-white rounded-2xl border border-gray-100">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {/* Intestazione Giorni (Lun - Dom) */}
                    <div className="grid grid-cols-7 border-b border-gray-100 bg-[#f8fafc]">
                        {['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'].map((d) => (
                            <div key={d} className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                <span className="hidden md:inline">{d}</span>
                                <span className="md:hidden">{d.slice(0, 3)}</span>
                            </div>
                        ))}
                    </div>

                    {/* Griglia Giorni */}
                    <div className="grid grid-cols-7 auto-rows-min min-h-[600px] bg-gray-200 gap-px">
                        {calendarDays.map((day, idx) => {
                            if (day === null) {
                                return <div key={`empty-${idx}`} className="bg-gray-50/50 min-h-[140px]" />;
                            }

                            const dayBookings = getBookingsForDay(day);
                            const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();

                            return (
                                <div key={day} className={`bg-white min-h-[140px] p-2 flex flex-col transition-colors hover:bg-gray-50/50 ${isToday ? 'bg-blue-50/30' : ''}`}>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-primary text-white' : 'text-gray-700'}`}>
                                            {day}
                                        </span>
                                        {dayBookings.length > 0 && (
                                            <span className="text-[10px] font-bold text-gray-400">
                                                {dayBookings.length} corse
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                                        {dayBookings.map((b: any) => (
                                            <div key={b.id} className="group relative">
                                                <div className={`px-2 py-1.5 rounded-lg text-xs border ${STATUS_COLORS[b.status] || 'bg-gray-100 text-gray-600 border-gray-200'} cursor-pointer overflow-hidden border-opacity-50`}>
                                                    <div className="font-bold flex items-center justify-between">
                                                        <span>{new Date(b.pickupAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
                                                        <Clock className="w-3 h-3 opacity-50" />
                                                    </div>
                                                    <div className="truncate opacity-90 mt-0.5">{b.passengerName}</div>
                                                    {b.driver && (
                                                        <div className="mt-1 flex items-center gap-1 font-semibold text-[10px] text-blue-700">
                                                            <span>Autista: {b.driver.name}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Tooltip on Hover */}
                                                <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl pointer-events-none">
                                                    <div className="font-bold mb-1">{b.passengerName}</div>
                                                    <div className="flex items-start gap-1 text-gray-300">
                                                        <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                                        <span>{b.origin?.name || '?'} → {b.destination?.name || '?'}</span>
                                                    </div>
                                                    {b.driver && (
                                                        <div className="mt-1.5 pt-1.5 border-t border-gray-700 text-blue-300 font-medium">
                                                            Autista: {b.driver.name}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

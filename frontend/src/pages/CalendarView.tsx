import { useState, useEffect } from 'react';
import api from '../lib/api';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, MapPin, Loader2, X, Info, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [showDayModal, setShowDayModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState<any>(null);

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
        return bookings.filter(b => {
            if (b.status === 'CANCELLED') return false;
            const bDate = new Date(b.pickupAt);
            return bDate.getFullYear() === year && 
                   bDate.getMonth() === month && 
                   bDate.getDate() === day;
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
                            title="Mese precedente"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                        <div className="w-px h-5 bg-gray-200"></div>
                        <button
                            onClick={handleNextMonth}
                            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-r-lg transition-colors"
                            title="Mese successivo"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border border-gray-100 space-y-4">
                    <Loader2 className="h-12 w-12 text-[#11355a] animate-spin" />
                    <p className="text-gray-500 font-medium">Caricamento in corso...</p>
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
                                    </div>

                                    <div 
                                        className="flex-1 flex flex-col items-center justify-center cursor-pointer group/cell relative"
                                        onClick={() => {
                                            if (dayBookings.length > 0) {
                                                setSelectedDay(day);
                                                setShowDayModal(true);
                                            }
                                        }}
                                    >
                                        {dayBookings.length > 0 ? (
                                            <>
                                                <div className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-xl border border-blue-100 font-bold text-xs hover:bg-blue-100 transition-colors">
                                                    {dayBookings.length} {dayBookings.length === 1 ? 'corsa' : 'corse'}
                                                </div>
                                                
                                                {/* Tooltip on Cell Hover - show summary of first few bookings */}
                                                <div className="absolute opacity-0 group-hover/cell:opacity-100 transition-opacity z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-gray-900 text-white text-[10px] rounded-xl p-3 shadow-xl pointer-events-none space-y-2">
                                                    <p className="font-bold border-b border-gray-700 pb-1 mb-1 text-blue-400">Anteprima {day}/{month + 1}</p>
                                                    {dayBookings.slice(0, 3).map((b: any) => (
                                                        <div key={b.id} className="flex justify-between items-start gap-2">
                                                            <span className="font-bold text-gray-400 shrink-0">{new Date(b.pickupAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
                                                            <span className="truncate flex-1 text-left">{b.origin?.name || b.originRaw}</span>
                                                        </div>
                                                    ))}
                                                    {dayBookings.length > 3 && <p className="text-gray-500 italic text-center text-[9px]">e altre {dayBookings.length - 3}...</p>}
                                                    <p className="text-blue-300 font-bold mt-1 pt-1 border-t border-gray-700 text-center">Clicca per i dettagli</p>
                                                </div>
                                            </>
                                        ) : (
                                            <span className="text-gray-200 text-[10px] font-medium uppercase tracking-widest">Nessuna corsa</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Modal Elenco Corse del Giorno */}
            {showDayModal && selectedDay && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="bg-[#11355a] p-6 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold">Corse di {selectedDay} {currentDate.toLocaleDateString('it-IT', { month: 'long' })}</h3>
                                <p className="text-blue-100/70 text-xs">Elenco cronologico delle prenotazioni</p>
                            </div>
                            <button 
                                onClick={() => setShowDayModal(false)} 
                                className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
                                title="Chiudi"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-3">
                            {getBookingsForDay(selectedDay).map((b: any) => (
                                <div 
                                    key={b.id} 
                                    className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer group"
                                    onClick={() => {
                                        setSelectedBooking(b);
                                        setShowDetailModal(true);
                                    }}
                                >
                                    <div className="bg-blue-50 text-[#11355a] p-3 rounded-xl font-bold text-sm shrink-0 border border-blue-100">
                                        {new Date(b.pickupAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="font-bold text-gray-900 truncate">{b.passengerName}</p>
                                            <div className="shrink-0">
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${STATUS_COLORS[b.status] || 'bg-gray-100 text-gray-600'}`}>
                                                    {b.status}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-gray-500 overflow-hidden">
                                            <MapPin className="h-3 w-3 shrink-0" />
                                            <span className="truncate">{b.origin?.name || b.originRaw} → {b.destination?.name || b.destinationRaw}</span>
                                        </div>
                                        {b.driver && (
                                            <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-blue-600">
                                                <Car className="h-3.5 w-3.5" />
                                                <span>{b.driver.name}</span>
                                            </div>
                                        )}
                                    </div>
                                    <Info className="h-5 w-5 text-gray-300 group-hover:text-blue-500 transition-colors shrink-0" />
                                </div>
                            ))}
                        </div>
                        <div className="p-4 border-t border-gray-100 flex justify-end">
                            <Button onClick={() => setShowDayModal(false)} className="bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-xl px-6">Chiudi</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Dettaglio Singola Prenotazione (Recuperato da Bookings.tsx style) */}
            {showDetailModal && selectedBooking && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col">
                        <div className="bg-[#11355a] p-6 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold">Dettagli Prenotazione</h3>
                                <p className="text-blue-100/70 text-xs text-left">Riepilogo completo della corsa</p>
                            </div>
                            <button 
                                onClick={() => setShowDetailModal(false)} 
                                className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
                                title="Chiudi"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        
                        <div className="p-8 space-y-6 text-left">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Data e Ora</p>
                                    <p className="font-semibold text-gray-900">
                                        {new Date(selectedBooking.pickupAt).toLocaleDateString('it-IT')} {new Date(selectedBooking.pickupAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Stato</p>
                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_COLORS[selectedBooking.status]}`}>
                                        {selectedBooking.status}
                                    </span>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Percorso</p>
                                    <p className="text-sm font-bold text-[#11355a]">
                                        {selectedBooking.origin?.name || selectedBooking.originRaw}
                                    </p>
                                    <p className="text-gray-300 text-xs my-0.5 ml-2">▼</p>
                                    <p className="text-sm font-bold text-[#11355a]">
                                        {selectedBooking.destination?.name || selectedBooking.destinationRaw}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Passeggero</p>
                                    <p className="font-semibold text-gray-900">{selectedBooking.passengerName}</p>
                                    <p className="text-xs text-gray-500">{selectedBooking.passengerPhone}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Dettagli</p>
                                    <p className="text-sm text-gray-900">{selectedBooking.passengers} Pax • {selectedBooking.price ? `€${selectedBooking.price}` : 'P. da concordare'}</p>
                                </div>
                                {selectedBooking.driver && (
                                    <div className="col-span-2 p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-center gap-3">
                                        <Car className="h-5 w-5 text-blue-600" />
                                        <div>
                                            <p className="text-[10px] font-bold text-blue-400 uppercase">Autista Assegnato</p>
                                            <p className="font-bold text-blue-900">{selectedBooking.driver.name}</p>
                                        </div>
                                    </div>
                                )}
                                <div className="col-span-2">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Note</p>
                                    <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-600 min-h-[60px]">
                                        {selectedBooking.notes || 'Nessuna nota presente.'}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-100 flex justify-end">
                            <Button onClick={() => setShowDetailModal(false)} className="bg-[#11355a] text-white rounded-xl px-8 h-10">Chiudi</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

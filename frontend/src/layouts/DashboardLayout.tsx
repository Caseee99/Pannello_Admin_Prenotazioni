import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, Users, ReceiptText, LogOut, Menu, X, Settings, Car } from 'lucide-react';

const adminNavigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Tutte le Prenotazioni', href: '/bookings', icon: CalendarDays },
    { name: 'Calendario', href: '/calendar', icon: CalendarDays },
    { name: 'Autisti', href: '/drivers', icon: Users },
    { name: 'Agenzie', href: '/agencies', icon: Users },
    { name: 'Report Mensile', href: '/reports', icon: ReceiptText },
    { name: 'Configurazione', href: '/settings', icon: Settings },
];

const agencyNavigation = [
    { name: 'Le mie Prenotazioni', href: '/bookings', icon: CalendarDays },
];

export default function DashboardLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [role, setRole] = useState<string | null>(null);
    const navigate = useNavigate();
    const location = useLocation();

    // Simple auth check right in layout
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
        }
        const storedRole = localStorage.getItem('role');
        setRole(storedRole || 'admin');
    }, [navigate]);

    const navigation = role === 'agency' ? agencyNavigation : adminNavigation;

    return (
        <div className="flex h-screen overflow-hidden bg-[#f4f6f8] font-sans">

            {/* Mobile Sidebar Overlay */}
            <div
                className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity xl:hidden ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setSidebarOpen(false)}
            />

            {/* Sidebar Principale (Alonak Style - Dark Blue) */}
            <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#11355a] text-white flex flex-col transform transition-transform duration-300 ease-in-out xl:translate-x-0 xl:static xl:inset-auto xl:flex-shrink-0 ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
                
                {/* Logo Area */}
                <div className="flex h-20 items-center px-6 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/10 p-2 rounded-lg">
                            <Car className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-lg font-bold tracking-tight text-white leading-tight">CoopTaxi Napoli</span>
                            <span className="text-[10px] text-blue-200 uppercase tracking-widest leading-tight">Pannello Gestione</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between px-6 py-2 xl:hidden border-b border-white/10">
                   <span className="text-xs text-white/50 uppercase tracking-wider">Menu</span>
                   <button className="text-white/50 hover:text-white transition-colors" onClick={() => setSidebarOpen(false)}>
                        <X className="h-5 w-5" />
                   </button>
                </div>

                {/* Navigation Links */}
                <nav className="flex-1 space-y-1 px-3 py-6 overflow-y-auto">
                    {navigation.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.href;
                        
                        return (
                            <NavLink
                                key={item.name}
                                to={item.href}
                                className={`group flex items-center px-4 py-2.5 text-sm font-medium transition-all duration-200 
                                    ${isActive 
                                        ? 'bg-[#214975] text-white rounded-r-3xl rounded-l-md border-l-4 border-blue-400' 
                                        : 'text-blue-100/70 hover:bg-white/5 hover:text-white rounded-md border-l-4 border-transparent'
                                    }`
                                }
                                onClick={() => setSidebarOpen(false)}
                            >
                                <Icon className={`mr-3 h-5 w-5 flex-shrink-0 transition-colors ${isActive ? 'text-white' : 'text-blue-200/50 group-hover:text-white'}`} />
                                {item.name}
                            </NavLink>
                        );
                    })}
                </nav>

                {/* Footer Sidebar (Logout) */}
                <div className="p-4 mt-auto border-t border-white/10">
                    <button
                        onClick={() => {
                            localStorage.removeItem('token');
                            navigate('/login');
                        }}
                        className="flex w-full items-center px-4 py-2.5 text-sm font-medium text-blue-200/50 rounded-md hover:bg-red-500/10 hover:text-red-400 transition-colors group"
                    >
                        <LogOut className="mr-3 h-5 w-5 group-hover:text-red-400 transition-colors" />
                        Logout
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex flex-1 flex-col overflow-hidden bg-[#f4f6f8]">
                
                {/* Header Superiore Minimalista */}
                <header className="flex h-16 items-center justify-between bg-white px-4 sm:px-6 shadow-sm z-30">
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            className="xl:hidden -ml-2 inline-flex h-10 w-10 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <span className="sr-only">Open sidebar</span>
                            <Menu className="h-5 w-5" aria-hidden="true" />
                        </button>
                        
                        {/* Dynamic Page Title based on route */}
                        <h1 className="text-xl font-semibold text-gray-900 hidden sm:block">
                            {navigation.find(n => n.href === location.pathname)?.name || 'Pannello di Controllo'}
                        </h1>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        {/* Domain info placeholder come da screenshot */}
                        <div className="hidden md:flex items-center text-xs text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                            🔄 <span className="ml-1.5 font-medium text-gray-600">napoli-taxi-flow.com</span> <span className="ml-1 text-gray-400">is available</span>
                        </div>
                    </div>
                </header>

                {/* Vista Principale (Scrollable Content) */}
                <main className="flex-1 overflow-y-auto p-4 sm:p-6">
                    <div className="mx-auto w-full max-w-7xl">
                        {/* Qui dentro verrà renderizzata la pagina corrente (Dashboard, Bookings, ecc.) */}
                        <Outlet />
                    </div>
                </main>
            </div>

        </div>
    );
}

import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Button } from '@/components/ui/button';
import { UserPlus, Settings, Users } from 'lucide-react';

export default function Drivers() {
    const [drivers, setDrivers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [showAddModal, setShowAddModal] = useState(false);
    const [newDriver, setNewDriver] = useState({ name: '', phone: '', email: '', licensePlate: '', seats: 4 });

    const [editingAvailability, setEditingAvailability] = useState<any>(null);
    const [editingDriver, setEditingDriver] = useState<any>(null);
    const [viewingDriver, setViewingDriver] = useState<any>(null);

    const [availabilityData, setAvailabilityData] = useState({
        mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false
    });

    const fetchDrivers = async () => {
        try {
            const res = await api.get('/drivers');
            setDrivers(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

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

    const handleAddDriver = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/drivers', newDriver);
            setShowAddModal(false);
            setNewDriver({ name: '', phone: '', email: '', licensePlate: '', seats: 4 });
            fetchDrivers();
        } catch (err) {
            console.error(err);
            alert('Errore creazione autista');
        }
    };

    const handleEditDriver = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingDriver) return;
        try {
            await api.patch(`/drivers/${editingDriver.id}`, {
                name: editingDriver.name,
                phone: editingDriver.phone,
                email: editingDriver.email,
                licensePlate: editingDriver.licensePlate,
                seats: editingDriver.seats
            });
            setEditingDriver(null);
            fetchDrivers();
        } catch (err) {
            console.error(err);
            alert('Errore modifica autista');
        }
    };

    const handleSaveAvailability = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingAvailability) return;
        try {
            await api.patch(`/drivers/${editingAvailability.id}/availability`, availabilityData);
            setEditingAvailability(null);
            fetchDrivers();
        } catch (err) {
            console.error(err);
            alert('Errore salvataggio disponibilità');
        }
    };

    if (loading) return <div>Caricamento in corso...</div>;

    return (
            <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-4">
                    <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                        <Users className="mr-2 h-5 w-5 text-primary" /> Autisti
                    </h2>
                    <Button onClick={() => setShowAddModal(true)} className="bg-[#11355a] hover:bg-[#11355a]/90 text-white rounded-lg">
                        <UserPlus className="mr-2 h-4 w-4" /> Aggiungi autista
                    </Button>
                </div>

                <div className="rounded-xl border border-gray-100 shadow-sm bg-white overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-gray-400 text-xs font-medium border-b border-gray-100 bg-[#f8fafc]/50">
                                <tr>
                                    <th className="px-6 py-4 font-normal">Nome</th>
                                    <th className="px-6 py-4 font-normal">Telefono</th>
                                    <th className="px-6 py-4 font-normal text-center">Attivo</th>
                                    <th className="px-6 py-4 font-normal">Disponibilità</th>
                                    <th className="px-6 py-4 font-normal text-center">Corse mese</th>
                                    <th className="px-6 py-4 font-normal text-center">Importo mese</th>
                                    <th className="px-6 py-4 font-normal">CP/Posti</th>
                                    <th className="px-6 py-4 font-normal text-right">Azioni</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {drivers.map(driver => {
                                    const avail = driver.availabilities && driver.availabilities.length > 0 
                                        ? driver.availabilities[0] 
                                        : { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false };
                                    
                                    return (
                                        <tr key={driver.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-5 whitespace-nowrap font-medium text-gray-900 border-l-[3px] border-transparent hover:border-blue-400 focus:border-blue-400">
                                                {driver.name}
                                            </td>
                                            <td className="px-6 py-5 text-gray-700 whitespace-nowrap">
                                                {driver.phone}
                                            </td>
                                            <td className="px-6 py-5 text-center">
                                                {/* Custom Toggle Switch */}
                                                <div 
                                                    onClick={async () => {
                                                        try {
                                                            await api.patch(`/drivers/${driver.id}`, { active: !driver.active });
                                                            fetchDrivers();
                                                        } catch(e) { console.error(e); }
                                                    }}
                                                    className={`mx-auto relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full ${driver.active ? 'bg-emerald-500' : 'bg-gray-200'}`}
                                                >
                                                    <span className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${driver.active ? 'translate-x-1.5' : '-translate-x-1.5'}`} />
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-wrap gap-1" onClick={() => {
                                                    setAvailabilityData({ mon: avail.mon, tue: avail.tue, wed: avail.wed, thu: avail.thu, fri: avail.fri, sat: avail.sat, sun: avail.sun });
                                                    setEditingAvailability(driver);
                                                }}>
                                                    {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((day, idx) => {
                                                        const mapKey = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][idx];
                                                        const isAvail = avail[mapKey];
                                                        return (
                                                            <div key={idx} className={`px-2 py-1 text-[10px] rounded cursor-pointer transition-colors ${isAvail ? 'bg-[#11355a] text-white font-medium' : 'bg-gray-100 text-gray-400'}`}>
                                                                {day}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-center text-gray-500 font-medium">0</td>
                                            <td className="px-6 py-5 text-center text-gray-800 font-medium">€0.00</td>
                                            <td className="px-6 py-5 text-gray-600">
                                                <div className="flex flex-col text-xs">
                                                    {driver.licensePlate ? <span className="font-semibold">{driver.licensePlate}</span> : <span className="text-gray-300">N/A</span>}
                                                    {driver.seats ? <span className="text-gray-400">{driver.seats} pax</span> : null}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 whitespace-nowrap text-right">
                                                <div className="flex items-center justify-end gap-3 text-xs font-semibold">
                                                    <button onClick={() => setViewingDriver(driver)} className="flex items-center text-gray-500 hover:text-[#11355a] transition-colors">
                                                        <Settings className="h-3.5 w-3.5 mr-1" /> Dettaglio
                                                    </button>
                                                    <button onClick={() => setEditingDriver({...driver})} className="text-gray-500 hover:text-[#11355a] transition-colors">Modifica</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {drivers.length === 0 && (
                                    <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-400">Nessun autista registrato</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
            </div>

            {/* Add Driver Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-semibold mb-4">Aggiungi Autista</h3>
                        <form onSubmit={handleAddDriver} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Nome</label>
                                <input required className="w-full border rounded p-2" value={newDriver.name} onChange={e => setNewDriver({ ...newDriver, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Telefono (WhatsApp)</label>
                                <input required className="w-full border rounded p-2" value={newDriver.phone} onChange={e => setNewDriver({ ...newDriver, phone: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Email</label>
                                <input className="w-full border rounded p-2" type="email" value={newDriver.email} onChange={e => setNewDriver({ ...newDriver, email: e.target.value })} />
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium mb-1" title="Codice o targa identificativa">CP / Targa</label>
                                    <input className="w-full border rounded p-2 uppercase" placeholder="Es. CP 123" value={newDriver.licensePlate} onChange={e => setNewDriver({ ...newDriver, licensePlate: e.target.value })} />
                                </div>
                                <div className="w-24">
                                    <label className="block text-sm font-medium mb-1">Posti Auto</label>
                                    <input type="number" min="1" max="9" className="w-full border rounded p-2 text-center" value={newDriver.seats} onChange={e => setNewDriver({ ...newDriver, seats: parseInt(e.target.value) || 4 })} />
                                </div>
                            </div>
                            <div className="flex justify-end space-x-2 pt-4">
                                                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>Annulla</Button>
                                                <Button type="submit">Salva</Button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            )}

            {/* Edit Driver Modal */}
            {editingDriver && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-semibold mb-4">Modifica Autista</h3>
                        <form onSubmit={handleEditDriver} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Nome</label>
                                <input required className="w-full border rounded p-2" value={editingDriver.name} onChange={e => setEditingDriver({ ...editingDriver, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Telefono</label>
                                <input required className="w-full border rounded p-2" value={editingDriver.phone} onChange={e => setEditingDriver({ ...editingDriver, phone: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Email</label>
                                <input className="w-full border rounded p-2" type="email" value={editingDriver.email || ''} onChange={e => setEditingDriver({ ...editingDriver, email: e.target.value })} />
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium mb-1">CP / Targa</label>
                                    <input className="w-full border rounded p-2 uppercase" value={editingDriver.licensePlate || ''} onChange={e => setEditingDriver({ ...editingDriver, licensePlate: e.target.value })} />
                                </div>
                                <div className="w-24">
                                    <label className="block text-sm font-medium mb-1">Posti Auto</label>
                                    <input type="number" min="1" max="9" className="w-full border rounded p-2 text-center" value={editingDriver.seats || 4} onChange={e => setEditingDriver({ ...editingDriver, seats: parseInt(e.target.value) || 4 })} />
                                </div>
                            </div>
                            <div className="flex justify-end space-x-2 pt-4">
                                <Button type="button" variant="outline" onClick={() => setEditingDriver(null)}>Annulla</Button>
                                <Button type="submit">Salva Modifiche</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* View Driver Modal */}
            {viewingDriver && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-sm">
                        <h3 className="text-lg font-semibold mb-4 text-[#11355a]">Dettaglio Autista</h3>
                        <div className="space-y-3 text-sm">
                            <p><span className="font-semibold text-gray-500">Nome:</span> {viewingDriver.name}</p>
                            <p><span className="font-semibold text-gray-500">Telefono:</span> {viewingDriver.phone}</p>
                            <p><span className="font-semibold text-gray-500">Email:</span> {viewingDriver.email || 'N/A'}</p>
                            <p><span className="font-semibold text-gray-500">Posti / CP:</span> {viewingDriver.seats || 4} px / {viewingDriver.licensePlate || 'N/A'}</p>
                            <p><span className="font-semibold text-gray-500">Stato:</span> {viewingDriver.active ? 'Attivo' : 'Inattivo'}</p>
                            <div className="flex justify-end pt-4 border-t mt-4">
                                <Button onClick={() => setViewingDriver(null)}>Chiudi</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Availability Modal */}
            {editingAvailability && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-sm">
                        <h3 className="text-lg font-semibold mb-4">Disponibilità di {editingAvailability.name}</h3>
                        <form onSubmit={handleSaveAvailability} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day, idx) => {
                                    const labels = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
                                    return (
                                        <label key={day} className="flex items-center space-x-2">
                                            <input type="checkbox" checked={(availabilityData as any)[day]} onChange={e => setAvailabilityData({ ...availabilityData, [day]: e.target.checked })} />
                                            <span className="text-sm">{labels[idx]}</span>
                                        </label>
                                    );
                                })}
                            </div>
                            <div className="flex justify-between items-center pt-4 border-t mt-4">
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    className="text-xs h-8"
                                    onClick={() => setAvailabilityData({mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true})}
                                >
                                    Tutti i Giorni
                                </Button>
                                <div className="space-x-2">
                                    <Button type="button" variant="outline" onClick={() => setEditingAvailability(null)}>Annulla</Button>
                                    <Button type="submit">Salva</Button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Users, PlusCircle } from 'lucide-react';

export default function Agencies() {
    const [agencies, setAgencies] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState<any>(null);

    const [newAgency, setNewAgency] = useState({
        name: '',
        email: '',
        loginEmail: '',
        password: '',
    });

    const [editAgency, setEditAgency] = useState({
        id: '',
        name: '',
        email: '',
        active: true,
        password: '',
    });

    const loadAgencies = async () => {
        try {
            const res = await api.get('/agencies');
            setAgencies(res.data);
        } catch (e) {
            console.error(e);
            alert('Errore nel caricamento agenzie');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAgencies();
    }, []);

    const handleAddAgency = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/agencies', newAgency);
            setShowAddModal(false);
            setNewAgency({ name: '', email: '', loginEmail: '', password: '' });
            loadAgencies();
        } catch (e) {
            console.error(e);
            alert('Errore creazione agenzia');
        }
    };

    const handleEditAgency = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload: any = {
                name: editAgency.name,
                email: editAgency.email,
                active: editAgency.active,
            };
            if (editAgency.password) {
                payload.password = editAgency.password;
            }
            await api.patch(`/agencies/${editAgency.id}`, payload);
            setShowEditModal(null);
            setEditAgency({ id: '', name: '', email: '', active: true, password: '' });
            loadAgencies();
        } catch (e) {
            console.error(e);
            alert('Errore aggiornamento agenzia');
        }
    };

    if (loading) return <div>Caricamento in corso...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Agenzie Partner
                </h2>
                <Button
                    onClick={() => setShowAddModal(true)}
                    className="bg-[#11355a] hover:bg-[#11355a]/90 text-white rounded-lg"
                >
                    <PlusCircle className="mr-2 h-4 w-4" /> Nuova Agenzia
                </Button>
            </div>

            <Card className="rounded-xl border border-gray-100 shadow-sm bg-white overflow-hidden">
                <CardHeader className="bg-gray-50 border-b py-3 px-6">
                    <CardTitle className="text-sm font-semibold text-gray-700">
                        Elenco Agenzie
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-gray-400 text-xs font-medium border-b border-gray-100 bg-gray-50/60">
                                <tr>
                                    <th className="px-6 py-3 font-normal">Nome</th>
                                    <th className="px-6 py-3 font-normal">Email contatto</th>
                                    <th className="px-6 py-3 font-normal">Login</th>
                                    <th className="px-6 py-3 font-normal text-center">Stato</th>
                                    <th className="px-6 py-3 font-normal text-right">Azioni</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {agencies.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-10 text-center text-gray-400">
                                            Nessuna agenzia registrata.
                                        </td>
                                    </tr>
                                )}
                                {agencies.map((a) => (
                                    <tr key={a.id} className="hover:bg-gray-50/60 transition-colors">
                                        <td className="px-6 py-4 font-medium text-gray-900">
                                            {a.name}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {a.email || '—'}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {a.loginEmail}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span
                                                className={`inline-flex px-2 py-1 text-[11px] font-semibold rounded-full ${
                                                    a.active
                                                        ? 'bg-emerald-50 text-emerald-700'
                                                        : 'bg-gray-100 text-gray-500'
                                                }`}
                                            >
                                                {a.active ? 'Attiva' : 'Disattivata'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-xs"
                                                onClick={() => {
                                                    setEditAgency({
                                                        id: a.id,
                                                        name: a.name,
                                                        email: a.email || '',
                                                        active: a.active,
                                                        password: '',
                                                    });
                                                    setShowEditModal(a);
                                                }}
                                            >
                                                Modifica
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Modal Nuova Agenzia */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                        <h3 className="text-lg font-semibold mb-4">Crea nuova agenzia</h3>
                        <form onSubmit={handleAddAgency} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Nome agenzia</label>
                                <input
                                    required
                                    className="w-full border rounded p-2 text-sm"
                                    value={newAgency.name}
                                    onChange={(e) => setNewAgency({ ...newAgency, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Email contatto (opzionale)</label>
                                <input
                                    type="email"
                                    className="w-full border rounded p-2 text-sm"
                                    value={newAgency.email}
                                    onChange={(e) => setNewAgency({ ...newAgency, email: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Email / username di accesso</label>
                                <input
                                    required
                                    type="email"
                                    className="w-full border rounded p-2 text-sm"
                                    value={newAgency.loginEmail}
                                    onChange={(e) =>
                                        setNewAgency({ ...newAgency, loginEmail: e.target.value })
                                    }
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Password iniziale</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full border rounded p-2 text-sm"
                                    value={newAgency.password}
                                    onChange={(e) =>
                                        setNewAgency({ ...newAgency, password: e.target.value })
                                    }
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-4 border-t">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowAddModal(false)}
                                >
                                    Annulla
                                </Button>
                                <Button type="submit" className="bg-[#11355a] text-white">
                                    Salva
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Modifica Agenzia */}
            {showEditModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                        <h3 className="text-lg font-semibold mb-4">Modifica agenzia</h3>
                        <form onSubmit={handleEditAgency} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Nome agenzia</label>
                                <input
                                    required
                                    className="w-full border rounded p-2 text-sm"
                                    value={editAgency.name}
                                    onChange={(e) =>
                                        setEditAgency({ ...editAgency, name: e.target.value })
                                    }
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Email contatto</label>
                                <input
                                    type="email"
                                    className="w-full border rounded p-2 text-sm"
                                    value={editAgency.email}
                                    onChange={(e) =>
                                        setEditAgency({ ...editAgency, email: e.target.value })
                                    }
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Attiva</span>
                                <div
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full ${
                                        editAgency.active ? 'bg-emerald-500' : 'bg-gray-200'
                                    }`}
                                    onClick={() =>
                                        setEditAgency({
                                            ...editAgency,
                                            active: !editAgency.active,
                                        })
                                    }
                                >
                                    <span
                                        className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                            editAgency.active
                                                ? 'translate-x-1.5'
                                                : '-translate-x-1.5'
                                        }`}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Nuova password (lascia vuoto per non cambiare)
                                </label>
                                <input
                                    type="text"
                                    className="w-full border rounded p-2 text-sm"
                                    value={editAgency.password}
                                    onChange={(e) =>
                                        setEditAgency({ ...editAgency, password: e.target.value })
                                    }
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-4 border-t">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowEditModal(null)}
                                >
                                    Annulla
                                </Button>
                                <Button type="submit" className="bg-[#11355a] text-white">
                                    Salva modifiche
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}


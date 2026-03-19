import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Loader2 } from 'lucide-react';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await api.post('/auth/login', { username, password });
            if (response.data.token) {
                const token = response.data.token as string;
                localStorage.setItem('token', token);

                // Decodifica semplice del payload JWT per leggere il ruolo
                try {
                    const payloadPart = token.split('.')[1];
                    const decoded = JSON.parse(atob(payloadPart));
                    if (decoded?.role) {
                        localStorage.setItem('role', decoded.role);
                    }
                    if (decoded?.name) {
                        localStorage.setItem('agencyName', decoded.name);
                    }
                } catch {
                    // in caso di problemi nella decodifica, ignoriamo e restiamo sul flusso base
                }

                navigate('/');
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Errore di login');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-900">
            <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow-lg dark:bg-gray-800">
                <div className="text-center">
                    <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Admin Login</h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Pannello Gestione Prenotazioni Taxi</p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleLogin}>
                    {error && (
                        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/50 dark:text-red-400">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4 rounded-md shadow-sm">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Username o Email</label>
                            <input
                                type="text"
                                required
                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Inserisci username o email"
                                title="Username o Email"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                            <input
                                type="password"
                                required
                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white sm:text-sm"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                title="Password"
                            />
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative flex w-full justify-center items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-400"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Accesso in corso...
                                </>
                            ) : (
                                'Accedi'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

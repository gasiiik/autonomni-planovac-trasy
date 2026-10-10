import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CalendarRange, Heart, LogOut, Map as MapIcon, Route, Trash2 } from 'lucide-react';
import { deleteAccount, deleteTrip, fetchTrips, login, logout, register, useUser } from '../services/account';
import type { SavedTrip } from '../services/account';
import { clearLocalFavorites, useFavorites } from '../utils/favorites';

const inputClass = 'w-full border border-gray-300 rounded-xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-primary';
const daysWord = (n: number) => (n === 1 ? 'den' : n < 5 ? 'dny' : 'dní');

const tripUrl = (t: SavedTrip) => `${t.kind === 'vacation' ? '/dovolena/vysledek' : '/result'}?plan=${t.plan}`;

// Přihlášení / registrace
function AuthForm() {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [form, setForm] = useState({ name: '', email: '', password: '' });
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setBusy(true);
        try {
            if (mode === 'login') await login(form.email, form.password);
            else await register(form.email, form.password, form.name);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Něco se nepovedlo.');
        } finally {
            setBusy(false);
        }
    };

    const tab = (m: typeof mode) => `flex-1 py-2.5 rounded-full font-semibold transition ${mode === m ? 'bg-primary text-white' : 'text-primary-dark hover:bg-secondary'}`;

    return (
        <div className="max-w-md mx-auto">
            <h1 className="text-3xl md:text-4xl font-bold text-primary-dark mb-2">Můj účet</h1>
            <p className="text-gray-600 mb-6">
                Účet je dobrovolný – KrušnoPlán můžeš používat i bez něj. S účtem máš oblíbená místa na všech zařízeních
                a uložené všechny naplánované výlety a dovolené.
            </p>
            <div className="bg-white rounded-3xl shadow-xl shadow-primary/10 border border-secondary p-6 md:p-8">
                <div className="flex gap-2 p-1 bg-secondary/60 rounded-full mb-6" role="tablist">
                    <button type="button" role="tab" aria-selected={mode === 'login'} className={tab('login')} onClick={() => { setMode('login'); setError(''); }}>Přihlásit se</button>
                    <button type="button" role="tab" aria-selected={mode === 'register'} className={tab('register')} onClick={() => { setMode('register'); setError(''); }}>Založit účet</button>
                </div>
                <form onSubmit={submit} className="space-y-4">
                    {mode === 'register' && (
                        <label className="block">
                            <span className="block text-primary-dark mb-2">Jméno <span className="text-gray-400">(nepovinné)</span></span>
                            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoComplete="given-name" maxLength={100} className={inputClass} />
                        </label>
                    )}
                    <label className="block">
                        <span className="block text-primary-dark mb-2">E-mail</span>
                        <input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} autoComplete="email" className={inputClass} />
                    </label>
                    <label className="block">
                        <span className="block text-primary-dark mb-2">Heslo</span>
                        <input type="password" required minLength={mode === 'register' ? 8 : undefined} value={form.password}
                            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                            autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className={inputClass} />
                        {mode === 'register' && <span className="block text-sm text-gray-500 mt-1">Aspoň 8 znaků.</span>}
                    </label>
                    {error && <p className="text-red-600 text-sm" role="alert">{error}</p>}
                    <button type="submit" disabled={busy} className="w-full py-3 rounded-full bg-accent text-primary-dark font-bold shadow-sm hover:bg-yellow-400 transition disabled:opacity-60">
                        {busy ? 'Chvilku…' : mode === 'login' ? 'Přihlásit se' : 'Založit účet'}
                    </button>
                </form>
            </div>
        </div>
    );
}

// Přihlášený uživatel: moje výlety, oblíbená, odhlášení, smazání účtu
function Profile() {
    const user = useUser()!;
    const favorites = useFavorites();
    const [trips, setTrips] = useState<SavedTrip[] | null>(null);
    const [error, setError] = useState('');

    useEffect(() => { fetchTrips().then(setTrips).catch(err => setError(err.message)); }, []);

    const removeTrip = async (id: number) => {
        await deleteTrip(id).catch(err => setError(err.message));
        setTrips(t => t?.filter(x => x.id !== id) ?? null);
    };
    const signOut = async () => { await logout(); clearLocalFavorites(); };
    const removeAccount = async () => {
        if (!window.confirm('Opravdu smazat účet? Smažou se i všechny uložené výlety a oblíbená místa. Nejde to vrátit.')) return;
        try {
            await deleteAccount();
            clearLocalFavorites();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Smazání se nepovedlo.');
        }
    };

    return (
        <div className="max-w-3xl mx-auto">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold text-primary-dark">Ahoj, {user.name}</h1>
                    <p className="text-gray-600">{user.email}</p>
                </div>
                <button onClick={signOut} className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-primary text-primary font-semibold hover:bg-primary hover:text-white transition">
                    <LogOut size={18} aria-hidden="true" /> Odhlásit se
                </button>
            </div>
            {error && <p className="text-red-600 mb-4" role="alert">{error}</p>}

            <section className="bg-white rounded-3xl shadow-xl shadow-primary/10 border border-secondary p-6 md:p-8 mb-6">
                <h2 className="text-xl font-bold text-primary-dark mb-1">Moje výlety</h2>
                <p className="text-sm text-gray-500 mb-5">Každý naplánovaný výlet a dovolená se sem uloží sám, i s pozdějšími úpravami.</p>
                {trips === null ? <p className="text-gray-500">Načítám…</p> : trips.length === 0 ? (
                    <div className="text-gray-600">
                        Zatím žádné výlety.{' '}
                        <Link to="/wizard" className="text-primary font-semibold underline">Naplánovat výlet</Link> nebo{' '}
                        <Link to="/dovolena" className="text-primary font-semibold underline">dovolenou</Link>.
                    </div>
                ) : (
                    <ul className="divide-y divide-secondary">
                        {trips.map(t => {
                            const Icon = t.kind === 'vacation' ? CalendarRange : Route;
                            return (
                                <li key={t.id} className="flex items-center gap-4 py-3">
                                    <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-secondary text-primary shrink-0">
                                        <Icon size={20} aria-hidden="true" />
                                    </span>
                                    <Link to={tripUrl(t)} className="flex-1 min-w-0 group">
                                        <span className="block font-semibold text-primary-dark group-hover:underline truncate">{t.title}</span>
                                        <span className="block text-sm text-gray-500">
                                            {t.trip_date ? new Date(t.trip_date).toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' }) : ''}
                                            {t.kind === 'vacation' && t.days ? ` · ${t.days} ${daysWord(t.days)}` : ''}
                                            {t.stops != null ? ` · ${t.stops} ${t.stops === 1 ? 'zastávka' : t.stops < 5 ? 'zastávky' : 'zastávek'}` : ''}
                                        </span>
                                    </Link>
                                    <button onClick={() => removeTrip(t.id)} title="Smazat z mých výletů" aria-label={`Smazat ${t.title}`}
                                        className="p-2 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition">
                                        <Trash2 size={18} aria-hidden="true" />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            <section className="bg-white rounded-3xl shadow-xl shadow-primary/10 border border-secondary p-6 md:p-8 mb-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Heart size={24} className="text-red-500" fill="currentColor" aria-hidden="true" />
                    <div>
                        <h2 className="text-xl font-bold text-primary-dark">Oblíbená místa</h2>
                        <p className="text-sm text-gray-500">{favorites.length} {favorites.length === 1 ? 'místo' : favorites.length > 1 && favorites.length < 5 ? 'místa' : 'míst'} · uložená v účtu</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <Link to="/oblibene" className="px-5 py-2 rounded-full bg-primary text-white font-semibold hover:bg-primary-dark transition">Zobrazit</Link>
                    <Link to="/mapa" className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-primary text-primary font-semibold hover:bg-primary hover:text-white transition">
                        <MapIcon size={18} aria-hidden="true" /> Mapa míst
                    </Link>
                </div>
            </section>

            <p className="text-sm text-gray-500">
                Ukládáme jen e-mail, jméno, oblíbená místa a tvoje výlety. Heslo neukládáme v čitelné podobě.{' '}
                <button onClick={removeAccount} className="text-red-600 underline hover:text-red-800">Smazat účet a všechna data</button>
            </p>
        </div>
    );
}

export default function Account() {
    const user = useUser();
    return (
        <div className="container mx-auto pt-28 pb-12 px-4">
            {user ? <Profile /> : <AuthForm />}
        </div>
    );
}

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Route } from 'lucide-react';
import type { Category, Location, PlanRequest } from '../types/api';
import { fetchLocations } from '../services/apiClient';
import { CATEGORY_LABELS, TRANSPORT_LABELS } from '../constants';
import { CategoryTag } from '../components/Icons';
import PlaceImage from '../components/PlaceImage';
import FavoriteButton from '../components/FavoriteButton';
import { useFavorites } from '../utils/favorites';
import type { FavoritePlace } from '../utils/favorites';
import { currentTimes, localDate, normalizeTimes, resultUrl } from '../utils/plan';
import { distanceKm } from '../utils/vacation';

const inputClass = 'w-full border border-gray-300 rounded-xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-primary';
const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[];

// Výlet z oblíbených: start v obci nejblíž středu vybraných míst, plánovač bere jen tato místa
function toPlanRequest(places: FavoritePlace[], locations: Location[], form: { date: string; time_from: string; time_to: string; transport_mode: PlanRequest['transport_mode'] }): PlanRequest {
    const center = {
        lat: places.reduce((s, p) => s + p.lat, 0) / places.length,
        lng: places.reduce((s, p) => s + p.lng, 0) / places.length,
    };
    const start = [...locations].sort((a, b) => distanceKm(center, a) - distanceKm(center, b))[0];
    const ids = places.map(p => p.id);
    const t = normalizeTimes(form);
    return {
        location_id: start.id,
        time_from: `${t.date} ${t.time_from}:00`,
        time_to: `${t.date} ${t.time_to}:00`,
        transport_mode: form.transport_mode,
        route_type: 'LOOP',
        interests: ALL_CATEGORIES,
        food_preferences: [],
        willing_to_pay_entry: true,
        difficulty: 'HARD',
        has_children: false,
        only_ids: ids,
        favorite_ids: ids,
    };
}

export default function Favorites() {
    const favorites = useFavorites();
    const navigate = useNavigate();
    const [locations, setLocations] = useState<Location[]>([]);
    const [unselected, setUnselected] = useState<number[]>([]);   // ve výchozím stavu vybrané všechny
    const [form, setForm] = useState(() => ({ ...currentTimes(), transport_mode: 'CAR' as PlanRequest['transport_mode'] }));
    const [error, setError] = useState('');

    useEffect(() => { fetchLocations().then(setLocations).catch(err => setError(err.message)); }, []);

    const selected = favorites.filter(f => !unselected.includes(f.id));
    const toggle = (id: number) => setUnselected(u => (u.includes(id) ? u.filter(x => x !== id) : [...u, id]));

    const plan = () => {
        if (!selected.length) return setError('Vyber aspoň jedno místo.');
        if (!locations.length) return setError('Načítám obce, zkus to prosím za chvilku.');
        if (form.time_to <= form.time_from) return setError('Návrat musí být později než odjezd.');
        navigate(resultUrl(toPlanRequest(selected, locations, form)));
    };

    return (
        <div className="container mx-auto pt-28 pb-12 px-4 max-w-5xl">
            <h1 className="text-3xl md:text-4xl font-bold text-primary-dark mb-2 flex items-center gap-3">
                <Heart size={30} className="text-red-500" fill="currentColor" aria-hidden="true" /> Oblíbená místa
            </h1>
            <p className="text-gray-600 mb-8">Místa, která sis označil srdíčkem. Jsou uložená jen v tomhle prohlížeči.</p>

            {favorites.length === 0 ? (
                <div className="bg-white rounded-3xl shadow-lg border border-secondary p-8 text-center">
                    <p className="text-lg text-primary-dark font-semibold mb-2">Zatím tu nic není</p>
                    <p className="text-gray-600 mb-6">Srdíčko najdeš u každého místa v detailu i v naplánovaném výletu.</p>
                    <Link to="/mapa" className="inline-block px-6 py-3 rounded-full bg-primary text-white font-bold hover:bg-primary-dark transition">Projít mapu míst</Link>
                </div>
            ) : (
                <>
                    {/* Výlet z oblíbených */}
                    <div className="bg-white rounded-3xl shadow-lg border border-secondary p-6 md:p-8 mb-8">
                        <h2 className="text-xl font-bold text-primary-dark mb-1 flex items-center gap-2">
                            <Route size={22} className="text-primary" aria-hidden="true" /> Naplánovat výlet z oblíbených
                        </h2>
                        <p className="text-sm text-gray-600 mb-5">
                            Vybráno {selected.length} z {favorites.length} míst. Trasu složíme jen z nich – podle otevírací doby, a co se do dne nevejde, vynecháme.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                            <label className="block">
                                <span className="block text-primary-dark mb-2">Datum</span>
                                <input type="date" min={localDate(new Date())} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inputClass} />
                            </label>
                            <label className="block">
                                <span className="block text-primary-dark mb-2">Odjezd</span>
                                <input type="time" value={form.time_from} onChange={e => setForm(f => ({ ...f, time_from: e.target.value }))} className={inputClass} />
                            </label>
                            <label className="block">
                                <span className="block text-primary-dark mb-2">Návrat</span>
                                <input type="time" value={form.time_to} onChange={e => setForm(f => ({ ...f, time_to: e.target.value }))} className={inputClass} />
                            </label>
                            <label className="block">
                                <span className="block text-primary-dark mb-2">Doprava</span>
                                <select value={form.transport_mode} onChange={e => setForm(f => ({ ...f, transport_mode: e.target.value as PlanRequest['transport_mode'] }))} className={inputClass}>
                                    {Object.entries(TRANSPORT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                </select>
                            </label>
                        </div>
                        {error && <p className="text-red-600 text-sm mt-4">{error}</p>}
                        <button onClick={plan} disabled={!selected.length}
                            className="mt-6 px-8 py-3 rounded-full bg-accent text-primary-dark font-bold shadow-sm hover:bg-yellow-400 transition disabled:opacity-50">
                            Vytvořit výlet
                        </button>
                    </div>

                    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {favorites.map(f => {
                            const on = !unselected.includes(f.id);
                            return (
                                <li key={f.id} className={`bg-white rounded-2xl shadow-sm border-2 overflow-hidden transition ${on ? 'border-primary' : 'border-gray-100 opacity-70'}`}>
                                    <div className="relative">
                                        <PlaceImage src={f.image_url} alt={f.name} category={f.category} className="w-full h-40" />
                                        <FavoriteButton place={f} className="absolute top-3 right-3 shadow" />
                                    </div>
                                    <div className="p-4">
                                        <p className="font-bold text-primary-dark mb-1">{f.name}</p>
                                        <div className="text-sm mb-3"><CategoryTag category={f.category} label={CATEGORY_LABELS[f.category] ?? f.category} /></div>
                                        <div className="flex items-center justify-between text-sm">
                                            <label className="inline-flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" checked={on} onChange={() => toggle(f.id)} className="h-5 w-5 rounded text-primary focus:ring-primary" />
                                                Do výletu
                                            </label>
                                            {f.id > 0 && <Link to={`/misto/${f.id}`} className="text-primary font-semibold underline">Detail</Link>}
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
        </div>
    );
}

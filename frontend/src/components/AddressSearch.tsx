import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { searchAddress } from '../services/apiClient';
import type { AddressResult } from '../services/apiClient';

// Výchozí místo zadané adresou: návrhy se hledají samy během psaní (po krátké pauze, Nominatim
// dovoluje jen cca 1 dotaz za vteřinu) a výsledek se vybere ze seznamu
export default function AddressSearch({ onPick }: { onPick: (a: AddressResult) => void }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<AddressResult[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const near = useRef<{ lat: number; lng: number } | null>(null);   // poloha uživatele (jen když ji už povolil)
    const latest = useRef(0);   // zahazuje opožděné odpovědi na starší dotaz

    // Bez dotazu na oprávnění: polohu použijeme jen tehdy, když ji prohlížeč už povolil (řazení výsledků podle blízkosti)
    useEffect(() => {
        navigator.permissions?.query({ name: 'geolocation' }).then(st => {
            if (st.state === 'granted') {
                navigator.geolocation.getCurrentPosition(
                    pos => { near.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }; }, () => {});
            }
        }).catch(() => {});
    }, []);

    useEffect(() => {
        const q = query.trim();
        if (q.length < 2) {
            latest.current++;
            setResults(null); setError(''); setLoading(false);
            return;
        }
        const id = ++latest.current;
        setLoading(true);
        const timer = setTimeout(async () => {
            try {
                const found = await searchAddress(q, near.current);
                if (id !== latest.current) return;
                setResults(found); setError('');
            } catch (err) {
                if (id !== latest.current) return;
                setResults(null);
                setError(err instanceof Error ? err.message : 'Adresu se nepodařilo vyhledat.');
            } finally {
                if (id === latest.current) setLoading(false);
            }
        }, 350);
        return () => clearTimeout(timer);
    }, [query]);

    return (
        <div>
            <div className="relative">
                <Search size={18} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={query} onChange={e => setQuery(e.target.value)} autoComplete="off"
                    placeholder="Začni psát adresu, např. T. G. Masaryka 1, Cheb"
                    aria-label="Adresa výchozího místa"
                    className="w-full border border-gray-300 rounded-xl p-3 pl-10 focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            {loading && <p className="text-sm text-gray-500 mt-2">Hledám…</p>}
            {error && <p className="text-sm text-red-700 mt-2">{error}</p>}
            {!loading && results && results.length === 0 && (
                <p className="text-sm text-gray-600 mt-2">Adresu jsem v Karlovarském kraji nenašel – zkus ji upřesnit (ulice, číslo, obec).</p>
            )}
            {results && results.length > 0 && (
                <ul className="mt-2 border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden bg-white shadow-sm">
                    {results.map(r => (
                        <li key={`${r.lat},${r.lng}`}>
                            <button type="button" onClick={() => onPick(r)}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-secondary">
                                {r.name}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

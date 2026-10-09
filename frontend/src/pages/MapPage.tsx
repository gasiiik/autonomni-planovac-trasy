import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Category, Place } from '../types/api';
import { fetchPlaces } from '../services/apiClient';
import { CATEGORY_COLORS, CATEGORY_ICONS, CATEGORY_LABELS } from '../constants';

const CATEGORIES: Category[] = ['SIGHTSEEING', 'PARK', 'FUN', 'GASTRO'];
const KV_REGION_CENTER: [number, number] = [50.17, 12.75];

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export default function MapPage() {
    const navigate = useNavigate();
    const [places, setPlaces] = useState<Place[]>([]);
    const [error, setError] = useState('');
    const [categories, setCategories] = useState<Category[]>(CATEGORIES);
    const [freeOnly, setFreeOnly] = useState(false);
    const [indoorOnly, setIndoorOnly] = useState(false);
    const [query, setQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const layerRef = useRef<L.LayerGroup | null>(null);

    useEffect(() => {
        fetchPlaces().then(setPlaces).catch(err => setError(err.message));
    }, []);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return places.filter(p =>
            categories.includes(p.category)
            && (!freeOnly || p.price === 0)
            && (!indoorOnly || p.indoor)
            && (!q || p.name.toLowerCase().includes(q)));
    }, [places, categories, freeOnly, indoorOnly, query]);

    // Mapa se vytvoří jednou, značky se překreslují podle filtrů
    useEffect(() => {
        if (!containerRef.current) return;
        const map = L.map(containerRef.current).setView(KV_REGION_CENTER, 10);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);
        layerRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;

        // Odkaz v bublině -> navigace v rámci aplikace (bez načtení celé stránky)
        const onClick = (e: MouseEvent) => {
            const link = (e.target as HTMLElement).closest('a[data-place]');
            if (link) {
                e.preventDefault();
                navigate(`/misto/${link.getAttribute('data-place')}`);
            }
        };
        containerRef.current.addEventListener('click', onClick);
        const container = containerRef.current;
        return () => { container.removeEventListener('click', onClick); map.remove(); };
    }, [navigate]);

    useEffect(() => {
        const layer = layerRef.current;
        if (!layer) return;
        layer.clearLayers();
        filtered.forEach(p => {
            const img = p.image_url ? `<img src="${escapeHtml(p.image_url)}" alt="" style="width:220px;height:120px;object-fit:cover;border-radius:8px;margin-bottom:6px">` : '';
            L.circleMarker([p.lat, p.lng], {
                radius: 7, color: '#fff', weight: 2, fillColor: CATEGORY_COLORS[p.category], fillOpacity: 0.9,
            }).bindPopup(`${img}<div style="font-size:12px;color:#666">${CATEGORY_ICONS[p.category]} ${CATEGORY_LABELS[p.category]} · ${p.price ? `${Math.round(p.price)} Kč` : 'zdarma'}</div>
                <strong style="font-size:14px">${escapeHtml(p.name)}</strong><br>
                <a href="/misto/${p.id}" data-place="${p.id}" style="color:#087F78;font-weight:600">Detail místa →</a>`)
                .addTo(layer);
        });
    }, [filtered]);

    const toggleCategory = (c: Category) =>
        setCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

    const chip = (active: boolean) =>
        `px-4 py-2 rounded-full border text-sm font-semibold transition ${active ? 'bg-primary text-white border-primary' : 'bg-white text-primary-dark border-gray-300 hover:border-primary'}`;

    return (
        <div className="container mx-auto pt-28 pb-12 px-4">
            <h1 className="text-3xl md:text-4xl font-bold text-primary-dark mb-2">Mapa míst</h1>
            <p className="text-gray-600 mb-6">Všechna místa, ze kterých plánovač skládá výlety – z otevřených dat Karlovarského kraje.</p>

            <div className="flex flex-wrap items-center gap-3 mb-4">
                {CATEGORIES.map(c => (
                    <button key={c} onClick={() => toggleCategory(c)} className={chip(categories.includes(c))}>
                        <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle" style={{ background: CATEGORY_COLORS[c] }} />
                        {CATEGORY_LABELS[c]}
                    </button>
                ))}
                <button onClick={() => setFreeOnly(v => !v)} className={chip(freeOnly)}>Zdarma</button>
                <button onClick={() => setIndoorOnly(v => !v)} className={chip(indoorOnly)}>Uvnitř (při dešti)</button>
                <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Hledat místo…"
                    className="flex-1 min-w-[180px] border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>

            {error && <p className="bg-red-100 text-red-700 p-3 rounded-xl mb-4">{error}</p>}
            <p className="text-sm text-gray-500 mb-2">Zobrazeno {filtered.length} z {places.length} míst</p>

            <div className="rounded-3xl overflow-hidden shadow-lg border border-secondary h-[70vh] relative z-0">
                <div ref={containerRef} className="w-full h-full" />
            </div>
        </div>
    );
}

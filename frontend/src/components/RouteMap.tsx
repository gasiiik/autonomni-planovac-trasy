import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Waypoint } from '../types/api';

// Číslované značky přes divIcon - výchozí obrázkové ikony Leafletu se s Vite bundlerem nenačtou
function markerIcon(label: string, start: boolean, active = false) {
    const bg = start ? '#155E50' : active ? '#F4D35E' : '#087F78';
    const fg = active ? '#155E50' : '#fff';
    const size = active ? 38 : 30;
    return L.divIcon({
        className: '',
        html: `<div style="background:${bg};color:${fg};width:${size}px;height:${size}px;border-radius:50%;border:3px solid ${active ? '#155E50' : '#F4D35E'};
                display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;
                box-shadow:0 2px 6px rgba(0,0,0,.35);transition:all .2s">${label}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    });
}

// Vlajka startu (ikona Flag z Lucide jako SVG - značky Leafletu jsou HTML řetězce)
const FLAG_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>';

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// Trasa po skutečných cestách: OSRM nad OpenStreetMap (FOSSGIS) - auto, kolo i pěšky
const ROUTING_PROFILE: Record<string, string> = { CAR: 'routed-car', BIKE: 'routed-bike', WALK: 'routed-foot' };

async function fetchRoadRoute(points: L.LatLng[], transport: string, signal: AbortSignal): Promise<L.LatLng[] | null> {
    const profile = ROUTING_PROFILE[transport] ?? 'routed-car';
    const coords = points.map(p => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(';');
    const res = await fetch(`https://routing.openstreetmap.de/${profile}/route/v1/driving/${coords}?overview=full&geometries=geojson`, { signal });
    if (!res.ok) return null;
    const data = await res.json();
    const line: [number, number][] | undefined = data.routes?.[0]?.geometry?.coordinates;
    return data.code === 'Ok' && line?.length ? line.map(([lng, lat]) => L.latLng(lat, lng)) : null;
}

interface Props {
    waypoints: Waypoint[];
    transport?: string;                       // CAR / BIKE / WALK - podle toho trasa po silnicích, cyklostezkách nebo cestách
    activeStop?: number | null;               // číslo zastávky zvýrazněné v seznamu
    onSelectStop?: (stop: number) => void;    // klik na značku -> posun seznamu na zastávku
}

export default function RouteMap({ waypoints, transport = 'CAR', activeStop = null, onSelectStop }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const markersRef = useRef<Map<number, L.Marker>>(new Map());
    const onSelectRef = useRef(onSelectStop);

    useEffect(() => { onSelectRef.current = onSelectStop; }, [onSelectStop]);

    useEffect(() => {
        if (!containerRef.current || waypoints.length === 0) return;
        const map = L.map(containerRef.current, { scrollWheelZoom: false });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);

        const points = waypoints.map(w => L.latLng(w.lat, w.lng));
        // Nejdřív vzdušnou čarou (hned), po načtení ji nahradí trasa po skutečných cestách
        const straight = L.polyline(points, { color: '#087F78', weight: 3, opacity: 0.6, dashArray: '6 8' }).addTo(map);
        const controller = new AbortController();
        fetchRoadRoute(points, transport, controller.signal)
            .then(road => {
                if (!road) return;
                straight.remove();
                L.polyline(road, { color: '#155E50', weight: 7, opacity: 0.35 }).addTo(map);   // lem
                L.polyline(road, { color: '#087F78', weight: 4, opacity: 0.95 }).addTo(map);
                map.attributionControl.addAttribution('Trasa: <a href="https://routing.openstreetmap.de/about.html">OSRM / FOSSGIS</a>');
            })
            .catch(() => undefined);   // služba nedostupná - zůstane vzdušná čára

        const markers = new Map<number, L.Marker>();
        let stop = 0;
        waypoints.forEach(w => {
            if (w.type === 'END_LOOP') return; // návrat končí ve startu, druhá značka by ho překryla
            const isStart = w.type === 'START';
            const n = isStart ? 0 : ++stop;
            const marker = L.marker([w.lat, w.lng], { icon: markerIcon(isStart ? FLAG_SVG : String(n), isStart) })
                .bindPopup(`<strong>${escapeHtml(w.name)}</strong>${isStart ? '<br>Start' : ''}`)
                .addTo(map);
            if (!isStart) {
                marker.on('click', () => onSelectRef.current?.(n));
                markers.set(n, marker);
            }
        });
        markersRef.current = markers;
        mapRef.current = map;

        map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
        return () => { controller.abort(); map.remove(); mapRef.current = null; markersRef.current = new Map(); };
    }, [waypoints, transport]);

    // Zvýraznění zastávky, na kterou uživatel ukazuje v seznamu
    useEffect(() => {
        markersRef.current.forEach((marker, n) => {
            marker.setIcon(markerIcon(String(n), false, n === activeStop));
            marker.setZIndexOffset(n === activeStop ? 1000 : 0);
        });
        // Mapu posuneme jen když zastávka není vidět (jinak by při projíždění seznamu pořád skákala)
        const active = activeStop ? markersRef.current.get(activeStop) : undefined;
        const map = mapRef.current;
        if (active && map && !map.getBounds().pad(-0.1).contains(active.getLatLng())) map.panTo(active.getLatLng(), { animate: true });
    }, [activeStop, waypoints]);

    return <div ref={containerRef} className="w-full h-full" />;
}

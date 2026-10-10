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

interface Props {
    waypoints: Waypoint[];
    activeStop?: number | null;               // číslo zastávky zvýrazněné v seznamu
    onSelectStop?: (stop: number) => void;    // klik na značku -> posun seznamu na zastávku
}

export default function RouteMap({ waypoints, activeStop = null, onSelectStop }: Props) {
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
        // Trasa (vzdušnou čarou - stejně jako počítá backend)
        L.polyline(points, { color: '#087F78', weight: 4, opacity: 0.8, dashArray: '8 8' }).addTo(map);

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
        return () => { map.remove(); mapRef.current = null; markersRef.current = new Map(); };
    }, [waypoints]);

    // Zvýraznění zastávky, na kterou uživatel ukazuje v seznamu
    useEffect(() => {
        markersRef.current.forEach((marker, n) => {
            marker.setIcon(markerIcon(String(n), false, n === activeStop));
            marker.setZIndexOffset(n === activeStop ? 1000 : 0);
        });
        const active = activeStop ? markersRef.current.get(activeStop) : undefined;
        if (active && mapRef.current) mapRef.current.panTo(active.getLatLng(), { animate: true });
    }, [activeStop, waypoints]);

    return <div ref={containerRef} className="w-full h-full" />;
}

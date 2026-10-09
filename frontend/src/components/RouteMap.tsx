import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Waypoint } from '../types/api';

// Číslované značky přes divIcon - výchozí obrázkové ikony Leafletu se s Vite bundlerem nenačtou
function markerIcon(label: string, start: boolean) {
    const bg = start ? '#155E50' : '#087F78';
    return L.divIcon({
        className: '',
        html: `<div style="background:${bg};color:#fff;width:30px;height:30px;border-radius:50%;border:3px solid #F4D35E;
                display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;
                box-shadow:0 2px 6px rgba(0,0,0,.35)">${label}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
    });
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export default function RouteMap({ waypoints }: { waypoints: Waypoint[] }) {
    const containerRef = useRef<HTMLDivElement>(null);

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

        let stop = 0;
        waypoints.forEach(w => {
            if (w.type === 'END_LOOP') return; // návrat končí ve startu, druhá značka by ho překryla
            const label = w.type === 'START' ? '★' : String(++stop);
            L.marker([w.lat, w.lng], { icon: markerIcon(label, w.type === 'START') })
                .bindPopup(`<strong>${escapeHtml(w.name)}</strong>${w.type === 'START' ? '<br>Start' : ''}`)
                .addTo(map);
        });

        map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
        return () => { map.remove(); };
    }, [waypoints]);

    return <div ref={containerRef} className="w-full h-full" />;
}

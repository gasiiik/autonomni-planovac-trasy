import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Waypoint } from '../types/api';
import { DAY_COLORS } from '../constants';

// Přehled celé dovolené: trasy všech dnů v jedné mapě, každý den jinou barvou


const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export default function TripOverviewMap({ days, onSelectDay }: { days: Waypoint[][]; onSelectDay: (day: number) => void }) {
    const ref = useRef<HTMLDivElement>(null);
    const onSelectRef = useRef(onSelectDay);
    useEffect(() => { onSelectRef.current = onSelectDay; }, [onSelectDay]);

    useEffect(() => {
        if (!ref.current) return;
        const map = L.map(ref.current, { scrollWheelZoom: false });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);

        const all: L.LatLng[] = [];
        days.forEach((wps, d) => {
            const color = DAY_COLORS[d % DAY_COLORS.length];
            const points = wps.map(w => L.latLng(w.lat, w.lng));
            all.push(...points);
            const line = L.polyline(points, { color, weight: 4, opacity: 0.85 }).addTo(map);
            line.bindTooltip(`Den ${d + 1}`, { sticky: true });
            line.on('click', () => onSelectRef.current(d));
            wps.filter(w => w.type === 'POI').forEach(w => {
                L.circleMarker([w.lat, w.lng], { radius: 6, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 })
                    .bindTooltip(`Den ${d + 1}: ${escapeHtml(w.name)}`)
                    .on('click', () => onSelectRef.current(d))
                    .addTo(map);
            });
        });
        // Ubytování / starty dnů
        days.forEach(wps => {
            const start = wps.find(w => w.type === 'START');
            if (start) {
                L.circleMarker([start.lat, start.lng], { radius: 9, color: '#155E50', weight: 3, fillColor: '#F4D35E', fillOpacity: 1 })
                    .bindTooltip(`Ubytování: ${escapeHtml(start.name)}`).addTo(map);
            }
        });
        if (all.length) map.fitBounds(L.latLngBounds(all), { padding: [30, 30], maxZoom: 13 });
        else map.setView([50.17, 12.75], 9);
        return () => { map.remove(); };
    }, [days]);

    return <div ref={ref} className="w-full h-full" />;
}

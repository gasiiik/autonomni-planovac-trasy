import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Location } from '../types/api';

// Výběr obcí dovolené na mapě kraje: klik obec přidá / odebere, vybrané mají pořadové číslo

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function numberIcon(n: number) {
    return L.divIcon({
        className: '',
        html: `<div style="background:#087F78;color:#fff;width:28px;height:28px;border-radius:50%;border:3px solid #F4D35E;
                display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,.35)">${n}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
    });
}

interface Props {
    locations: Location[];
    selected: string[];              // id obcí v pořadí výběru
    onToggle: (id: string) => void;
}

export default function TownMap({ locations, selected, onToggle }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const layerRef = useRef<L.LayerGroup | null>(null);
    const onToggleRef = useRef(onToggle);

    useEffect(() => { onToggleRef.current = onToggle; }, [onToggle]);

    useEffect(() => {
        if (!containerRef.current) return;
        const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView([50.17, 12.75], 9);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 16,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);
        layerRef.current = L.layerGroup().addTo(map);
        return () => { map.remove(); };
    }, []);

    useEffect(() => {
        const layer = layerRef.current;
        if (!layer) return;
        layer.clearLayers();
        locations.forEach(l => {
            const id = String(l.id);
            const order = selected.indexOf(id);
            const marker = order >= 0
                ? L.marker([l.lat, l.lng], { icon: numberIcon(order + 1), zIndexOffset: 1000 })
                : L.circleMarker([l.lat, l.lng], { radius: 6, color: '#fff', weight: 2, fillColor: '#087F78', fillOpacity: 0.85 });
            marker.bindTooltip(`${escapeHtml(l.name)}${order >= 0 ? ' – kliknutím odebrat' : ''}`, { direction: 'top', offset: [0, -8] });
            marker.on('click', () => onToggleRef.current(id));
            marker.addTo(layer);
        });
    }, [locations, selected]);

    return <div ref={containerRef} className="w-full h-full" />;
}

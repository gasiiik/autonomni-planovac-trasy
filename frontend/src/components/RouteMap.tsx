import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { DAY_COLORS } from '../constants';
import { fetchRoute } from '../services/apiClient';
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

// Trasa se hledá po úsecích (zastávka -> zastávka): když se jeden úsek nepodaří (např. bod mimo cesty), nahradí ho jen
// vzdušná čára a zbytek trasy - včetně návratu do výchozího bodu - zůstane po cestách
async function fetchRoadRoute(points: L.LatLng[], transport: string, wheelchair: boolean, signal: AbortSignal, wholeOnly = false): Promise<{ line: L.LatLng[]; failed: number } | null> {
    if (points.length < 2) return null;
    const route = (pair: L.LatLng[]) => fetchRoute(pair, transport, wheelchair, signal)
        .then(line => line?.map(([lat, lng]) => L.latLng(lat, lng)) ?? null)
        .catch(err => { if (signal.aborted) throw err; return null; });
    // Nejdřív celá trasa jedním dotazem (rychlé, šetří veřejné služby); až když selže, po úsecích
    const whole = await route(points);
    if (whole) return { line: whole, failed: 0 };
    if (wholeOnly) return null;   // ostatní dny: bez úsekového dohledávání (zbytečně moc dotazů)
    const segments: (L.LatLng[] | null)[] = [];
    for (let i = 1; i < points.length; i++) segments.push(await route([points[i - 1], points[i]]));
    const failed = segments.filter(seg => !seg).length;
    if (failed === segments.length) return null;
    return { line: segments.flatMap((seg, i) => seg ?? [points[i], points[i + 1]]), failed };
}

interface Props {
    waypoints: Waypoint[];
    wheelchair?: boolean;                     // bezbariérová chůze - trasa bez schodů a prudkých stoupání
    transport?: string;                       // CAR / BIKE / WALK - podle toho trasa po silnicích, cyklostezkách nebo cestách
    otherDays?: { day: number; waypoints: Waypoint[] }[];   // dovolená: ostatní dny ve stejné mapě (barevně, zeslabené)
    onSelectDay?: (day: number) => void;                     // klik na trasu / bod jiného dne
    activeStop?: number | null;               // číslo zastávky zvýrazněné v seznamu
    onSelectStop?: (stop: number) => void;    // klik na značku -> posun seznamu na zastávku
}

export default function RouteMap({ waypoints, transport = 'CAR', wheelchair = false, otherDays = [], onSelectDay, activeStop = null, onSelectStop }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const markersRef = useRef<Map<number, L.Marker>>(new Map());
    const onSelectRef = useRef(onSelectStop);
    const onDayRef = useRef(onSelectDay);

    useEffect(() => { onSelectRef.current = onSelectStop; }, [onSelectStop]);
    useEffect(() => { onDayRef.current = onSelectDay; }, [onSelectDay]);

    useEffect(() => {
        if (!containerRef.current || waypoints.length === 0) return;
        const map = L.map(containerRef.current, { scrollWheelZoom: false });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);

        const controller = new AbortController();
        let otherRoutes: Promise<void> = Promise.resolve();
        const points = waypoints.map(w => L.latLng(w.lat, w.lng));
        // Ostatní dny dovolené: tenčí barevná trasa a body (klik otevře daný den)
        const everything: L.LatLng[] = [...points];
        otherDays.forEach(({ day, waypoints: wps }) => {
            const color = DAY_COLORS[day % DAY_COLORS.length];
            const pts = wps.map(w => L.latLng(w.lat, w.lng));
            everything.push(...pts);
            const dayLine = L.polyline(pts, { color, weight: 3, opacity: 0.55, dashArray: '4 6' }).bindTooltip(`Den ${day + 1}`, { sticky: true })
                .on('click', () => onDayRef.current?.(day)).addTo(map);
            // Vzdušná čára se po načtení nahradí trasou po skutečných cestách (dny se načítají postupně, šetříme službu)
            otherRoutes = otherRoutes.then(async () => {
                if (controller.signal.aborted) return;
                try {
                    const road = await fetchRoadRoute(pts, transport, wheelchair && transport === 'WALK', controller.signal, true);
                    if (!road || controller.signal.aborted) return;
                    dayLine.setLatLngs(road.line);
                    dayLine.setStyle({ weight: 4, opacity: 0.7, dashArray: undefined });
                } catch { /* služba nedostupná - zůstane vzdušná čára */ }
            });
            wps.filter(w => w.type === 'POI').forEach(w => {
                L.circleMarker([w.lat, w.lng], { radius: 5, color: '#fff', weight: 2, fillColor: color, fillOpacity: 0.9 })
                    .bindTooltip(`Den ${day + 1}: ${escapeHtml(w.name)}`)
                    .on('click', () => onDayRef.current?.(day)).addTo(map);
            });
        });
        // Nejdřív vzdušnou čarou (hned), po načtení ji nahradí trasa po skutečných cestách
        const straight = L.polyline(points, { color: '#087F78', weight: 3, opacity: 0.6, dashArray: '6 8' }).addTo(map);
        fetchRoadRoute(points, transport, wheelchair && transport === 'WALK', controller.signal)
            .then(road => {
                if (!road) return;
                straight.remove();
                L.polyline(road.line, { color: '#155E50', weight: 7, opacity: 0.35 }).addTo(map);   // lem
                L.polyline(road.line, { color: '#087F78', weight: 4, opacity: 0.95 }).addTo(map);
                map.attributionControl.addAttribution(wheelchair && transport === 'WALK'
                    ? 'Trasa: <a href="https://valhalla.openstreetmap.de/">Valhalla / FOSSGIS</a> (bezbariérově)'
                    : 'Trasa: <a href="https://routing.openstreetmap.de/about.html">OSRM / FOSSGIS</a>');
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

        map.fitBounds(L.latLngBounds(everything), { padding: [40, 40], maxZoom: otherDays.length ? 13 : 15 });
        return () => { controller.abort(); map.remove(); mapRef.current = null; markersRef.current = new Map(); };
    }, [waypoints, transport, wheelchair, otherDays]);

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

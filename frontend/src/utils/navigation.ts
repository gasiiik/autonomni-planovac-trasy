import type { Waypoint } from '../types/api';

// Odkazy do navigace (Google Maps, Mapy.cz, Apple Mapy) - aplikace trasu jen zobrazuje, navigovat se dá v nich

const GOOGLE_MODE: Record<string, string> = { CAR: 'driving', BIKE: 'bicycling', WALK: 'walking' };
const MAPY_MODE: Record<string, string> = { CAR: 'car_fast', BIKE: 'bike_road', WALK: 'foot_fast' };
const APPLE_MODE: Record<string, string> = { CAR: 'driving', BIKE: 'cycling', WALK: 'walking' };

// Google Maps v odkazu zvládne nejvýš 9 mezizastávek (na mobilu méně - aplikace je případně zkrátí)
const GOOGLE_MAX_WAYPOINTS = 9;
// Mapy.cz (a u Apple Map držíme stejný limit) zvládnou až 15 průjezdních bodů
const MAPY_MAX_WAYPOINTS = 15;

const ll = (w: { lat: number; lng: number }) => `${w.lat},${w.lng}`;
const lonlat = (w: { lat: number; lng: number }) => `${w.lng},${w.lat}`;

// Start, zastávky a cíl (u okruhu zpět do startu) z bodů trasy z plánovače
function routePoints(waypoints: Waypoint[]) {
    const start = waypoints.find(w => w.type === 'START') ?? waypoints[0];
    const stops = waypoints.filter(w => w.type === 'POI');
    const loop = waypoints.some(w => w.type === 'END_LOOP');
    const end = loop ? start : stops[stops.length - 1] ?? start;
    const via = loop ? stops : stops.slice(0, -1);
    return { start, via, end };
}

export function googleRouteUrl(waypoints: Waypoint[], mode: string) {
    const { start, via, end } = routePoints(waypoints);
    const params = new URLSearchParams({ api: '1', origin: ll(start), destination: ll(end), travelmode: GOOGLE_MODE[mode] ?? 'driving' });
    if (via.length) params.set('waypoints', via.slice(0, GOOGLE_MAX_WAYPOINTS).map(ll).join('|'));
    return `https://www.google.com/maps/dir/?${params}`;
}

export function mapyRouteUrl(waypoints: Waypoint[], mode: string) {
    const { start, via, end } = routePoints(waypoints);
    const params = new URLSearchParams({ start: lonlat(start), end: lonlat(end), routeType: MAPY_MODE[mode] ?? 'car_fast' });
    if (via.length) params.set('waypoints', via.slice(0, MAPY_MAX_WAYPOINTS).map(lonlat).join(';'));
    return `https://mapy.cz/fnc/v1/route?${params}`;
}

// Apple Mapy - "unified Maps URLs" (iOS 18.4+, macOS 15.4+), mezizastávky opakovaným parametrem waypoint
export function appleRouteUrl(waypoints: Waypoint[], mode: string) {
    const { start, via, end } = routePoints(waypoints);
    const params = new URLSearchParams({ source: ll(start), destination: ll(end), mode: APPLE_MODE[mode] ?? 'driving' });
    via.slice(0, MAPY_MAX_WAYPOINTS).forEach(w => params.append('waypoint', ll(w)));
    return `https://maps.apple.com/directions?${params}`;
}

// Navigace k jednomu místu (z aktuální polohy uživatele)
export const googlePlaceNavUrl = (lat: number, lng: number, mode = 'CAR') =>
    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=${GOOGLE_MODE[mode] ?? 'driving'}`;

export const mapyPlaceNavUrl = (lat: number, lng: number, mode = 'CAR') =>
    `https://mapy.cz/fnc/v1/route?end=${lng},${lat}&routeType=${MAPY_MODE[mode] ?? 'car_fast'}`;

export const applePlaceNavUrl = (lat: number, lng: number, mode = 'CAR') =>
    `https://maps.apple.com/directions?destination=${lat},${lng}&mode=${APPLE_MODE[mode] ?? 'driving'}`;

export const tooManyForGoogle = (waypoints: Waypoint[]) => routePoints(waypoints).via.length > GOOGLE_MAX_WAYPOINTS;

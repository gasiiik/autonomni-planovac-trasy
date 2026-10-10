import { useSyncExternalStore } from 'react';
import type { Category } from '../types/api';
import { currentToken, fetchServerFavorites, putServerFavorites, setOnLogin } from '../services/account';

// Oblíbená místa - v prohlížeči (localStorage), s účtem se navíc ukládají na server (na všech zařízeních)
export interface FavoritePlace {
    id: number;
    name: string;
    category: Category;
    lat: number;
    lng: number;
    image_url: string | null;
}

const KEY = 'krusnoplan-oblibene';
const listeners = new Set<() => void>();
let cache: FavoritePlace[] | null = null;

function read(): FavoritePlace[] {
    if (cache) return cache;
    try {
        const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]');
        cache = Array.isArray(parsed) ? parsed : [];
    } catch {
        cache = [];   // soukromé okno, zablokované úložiště
    }
    return cache;
}

function write(list: FavoritePlace[], sync = true) {
    cache = list;
    if (sync && currentToken()) putServerFavorites(list).catch(() => undefined);
    try {
        localStorage.setItem(KEY, JSON.stringify(list));
    } catch {
        // úložiště nedostupné - oblíbené vydrží aspoň do zavření stránky
    }
    listeners.forEach(l => l());
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    // změna v jiné záložce
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) { cache = null; listener(); } };
    window.addEventListener('storage', onStorage);
    return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage); };
}

export const useFavorites = () => useSyncExternalStore(subscribe, read);

export function toggleFavorite(place: FavoritePlace) {
    const list = read();
    write(list.some(f => f.id === place.id) ? list.filter(f => f.id !== place.id) : [...list, place]);
}

export const removeFavorite = (id: number) => write(read().filter(f => f.id !== id));

// Při startu aplikace s účtem: platí seznam ze serveru (mohl se změnit na jiném zařízení)
export async function loadServerFavorites() {
    if (!currentToken()) return;
    try {
        write(await fetchServerFavorites(), false);
    } catch {
        // offline - zůstane seznam z prohlížeče
    }
}

// Po přihlášení: k oblíbeným z účtu přidáme ta, která si uživatel označil před přihlášením
setOnLogin(async () => {
    const server = await fetchServerFavorites();
    const local = read().filter(f => !server.some(s => s.id === f.id));
    write([...server, ...local], local.length > 0);
});

// Po odhlášení oblíbená z prohlížeče smažeme (zůstávají v účtu)
export const clearLocalFavorites = () => write([], false);

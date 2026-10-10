import { useSyncExternalStore } from 'react';
import type { Category } from '../types/api';

// Oblíbená místa - jen v tomto prohlížeči (localStorage), bez přihlašování
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

function write(list: FavoritePlace[]) {
    cache = list;
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

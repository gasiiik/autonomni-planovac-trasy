import { useSyncExternalStore } from 'react';
import type { FavoritePlace } from '../utils/favorites';

// Dobrovolný uživatelský účet: přihlášení si pamatujeme v prohlížeči (token), data jsou na serveru
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
const TOKEN_KEY = 'krusnoplan-token';
const USER_KEY = 'krusnoplan-user';

export interface User {
    id: number;
    email: string;
    name: string;
    created_at: string;
}

export interface SavedTrip {
    id: number;
    kind: 'trip' | 'vacation';
    title: string;
    trip_date: string | null;
    days: number | null;
    stops: number | null;
    plan: string;
    updated_at: string;
}

interface Session { token: string; user: User }

const listeners = new Set<() => void>();
let session: Session | null | undefined;

function load(): Session | null {
    if (session !== undefined) return session;
    try {
        const token = localStorage.getItem(TOKEN_KEY);
        const user = localStorage.getItem(USER_KEY);
        session = token && user ? { token, user: JSON.parse(user) } : null;
    } catch {
        session = null;
    }
    return session;
}

function save(next: Session | null) {
    session = next;
    try {
        if (next) {
            localStorage.setItem(TOKEN_KEY, next.token);
            localStorage.setItem(USER_KEY, JSON.stringify(next.user));
        } else {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
        }
    } catch {
        // úložiště nedostupné - přihlášení vydrží do zavření stránky
    }
    listeners.forEach(l => l());
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export const useUser = () => useSyncExternalStore(subscribe, () => load()?.user ?? null);
export const currentToken = () => load()?.token ?? null;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = currentToken();
    const res = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    const body = await res.json().catch(() => null);
    if (res.status === 401 && token && path.startsWith('/me')) save(null);   // přihlášení vypršelo
    if (!res.ok) throw new Error(body?.error ?? `Chyba serveru (HTTP ${res.status})`);
    return body as T;
}

// Po přihlášení: oblíbená z prohlížeče a z účtu se spojí (přihlásit se lze i se rozpracovaným seznamem)
let onLogin: ((user: User) => Promise<void>) | null = null;
export const setOnLogin = (fn: (user: User) => Promise<void>) => { onLogin = fn; };

async function startSession(res: Session) {
    save(res);
    await onLogin?.(res.user).catch(() => undefined);
}

export async function register(email: string, password: string, name: string) {
    await startSession(await request<Session>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }));
}

export async function login(email: string, password: string) {
    await startSession(await request<Session>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }));
}

export async function logout() {
    await request('/auth/logout', { method: 'POST', body: '{}' }).catch(() => undefined);
    save(null);
}

export async function deleteAccount() {
    await request('/me', { method: 'DELETE' });
    save(null);
}

// Ověření, že uložené přihlášení pořád platí (při startu aplikace)
export async function refreshUser() {
    if (!currentToken()) return;
    try {
        const user = await request<User>('/me');
        const s = load();
        if (s) save({ ...s, user });
    } catch {
        // 401 už přihlášení zrušil, výpadek sítě přihlášení nechá
    }
}

export const fetchServerFavorites = () => request<FavoritePlace[]>('/me/favorites');
export const putServerFavorites = (list: FavoritePlace[]) => request('/me/favorites', { method: 'PUT', body: JSON.stringify(list) });

export const fetchTrips = () => request<SavedTrip[]>('/me/trips');
export const deleteTrip = (id: number) => request(`/me/trips/${id}`, { method: 'DELETE' });
export const saveTrip = (trip: { key: string; kind: SavedTrip['kind']; title: string; trip_date: string; days: number; stops: number; plan: string }) =>
    request('/me/trips', { method: 'POST', body: JSON.stringify(trip) });

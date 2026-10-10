import type { PlanRequest } from '../types/api';

const pad = (n: number) => String(n).padStart(2, '0');

export const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const toMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
};
const fromMinutes = (mins: number) => {
    const capped = Math.min(Math.max(mins, 0), 23 * 60 + 59); // plán je v rámci jednoho dne
    return `${pad(Math.floor(capped / 60))}:${pad(capped % 60)}`;
};

export const addMinutes = (hhmm: string, mins: number) => fromMinutes(toMinutes(hhmm) + mins);

// Aktuální čas na minuty ("HH:MM") - nejdřívější možný odjezd dnes
export function nowRounded() {
    const now = new Date();
    return fromMinutes(now.getHours() * 60 + now.getMinutes());
}

// Odjezd = teď, návrat nejdřív v 18:00 / za 4 hodiny. Pozdě večer plánujeme na zítřek.
export function defaultTimes() {
    const now = new Date();
    if (now.getHours() >= 22) {
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        return { date: localDate(tomorrow), time_from: '09:00', time_to: '18:00' };
    }
    const from = nowRounded();
    return { date: localDate(now), time_from: from, time_to: fromMinutes(Math.max(toMinutes(from) + 4 * 60, 18 * 60)) };
}

// Průvodce výletem: vždy dnešní datum a aktuální čas (i pozdě večer - datum si uživatel případně změní)
export function currentTimes() {
    const from = nowRounded();
    return { date: localDate(new Date()), time_from: from, time_to: fromMinutes(Math.max(toMinutes(from) + 4 * 60, 18 * 60)) };
}

// Hlídá, aby odjezd nebyl v minulosti a návrat byl až po odjezdu (backend by jinak plán odmítl)
export function normalizeTimes<T extends { date: string; time_from: string; time_to: string }>(form: T): T {
    const today = localDate(new Date());
    let { date, time_from, time_to } = form;
    if (date < today) date = today;
    if (date === today && time_from < nowRounded()) time_from = nowRounded();
    if (time_to <= time_from) time_to = addMinutes(time_from, 60);
    return { ...form, date, time_from, time_to };
}

// Plán je celý v URL (?plan=...) -> odkaz jde sdílet a funguje i po obnovení stránky
// btoa umí jen Latin-1 -> JSON nejdřív převedeme na UTF-8 bajty (název startu "Vaše poloha" má diakritiku)
const toBase64 = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text)));
const fromBase64 = (b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0)));

export const encodePlan = (req: PlanRequest) => toBase64(JSON.stringify(req)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function decodePlan(encoded: string): PlanRequest | null {
    try {
        return JSON.parse(fromBase64(encoded.replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
        return null;
    }
}

export const resultUrl = (req: PlanRequest) => `/result?plan=${encodePlan(req)}`;

// Klíč výletu pro "Moje výlety": stejný výlet i po úpravách (výměna, odebrání zastávky, výběr ubytování)
const EDIT_FIELDS = ['exclude_ids', 'max_stops', 'only_ids', 'order_ids', 'swap_id', 'keep_ids', 'max_stops_by_day', 'only_ids_by_day', 'swap_by_day'];
export function tripKey(req: PlanRequest): string {
    const base: Record<string, unknown> = { ...req };
    EDIT_FIELDS.forEach(f => delete base[f]);
    if (req.vacation) base.vacation = { ...req.vacation, stays: undefined };
    const text = JSON.stringify(base);
    // 8× FNV-1a s různým začátkem = 64 hex znaků (crypto.subtle funguje jen na https)
    let out = '';
    for (let seed = 0; seed < 8; seed++) {
        let h = (0x811c9dc5 ^ (seed * 0x9e3779b9)) >>> 0;
        for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
        out += h.toString(16).padStart(8, '0');
    }
    return out;
}

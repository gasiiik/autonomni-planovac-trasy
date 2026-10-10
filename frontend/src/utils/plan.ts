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
export const encodePlan = (req: PlanRequest) => btoa(JSON.stringify(req)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function decodePlan(encoded: string): PlanRequest | null {
    try {
        return JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
        return null;
    }
}

export const resultUrl = (req: PlanRequest) => `/result?plan=${encodePlan(req)}`;

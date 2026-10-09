import type { PlanRequest } from '../types/api';

const pad = (n: number) => String(n).padStart(2, '0');

export const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Backend nedovolí plánovat do minulosti -> dnes začínáme nejdřív příští celou hodinu, večer plánujeme na zítřek
export function defaultTimes() {
    const now = new Date();
    if (now.getHours() >= 20) {
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        return { date: localDate(tomorrow), time_from: '09:00', time_to: '18:00' };
    }
    const from = Math.max(9, now.getHours() + 1);
    return { date: localDate(now), time_from: `${pad(from)}:00`, time_to: `${pad(Math.min(23, Math.max(from + 4, 18)))}:00` };
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

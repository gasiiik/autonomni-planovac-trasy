import type { AccommodationOption, Location, PlanRequest, PlanResponse } from '../types/api';
import { fetchAccommodation, fetchLocations, generatePlan } from '../services/apiClient';
import { localDate } from './plan';

// Plánování dovolené: dny se rozdělí mezi vybrané obce (v pořadí výběru), každý den je okruh
// z ubytování v dané obci a místa z předchozích dnů se neopakují.

export interface TripDay {
    date: string;          // YYYY-MM-DD
    town: Location;
    plan: PlanResponse;
}

export interface Stay {
    town: Location;
    firstDay: number;      // index dne, kdy do obce přijedeme
    days: number;          // kolik dní v obci strávíme (= počet nocí)
    options: AccommodationOption[];
}

export interface Trip {
    days: TripDay[];
    stays: Stay[];
}

// 5 dní ve 2 obcích -> 3 + 2; každá obec aspoň jeden den
export function allocateDays(days: number, towns: number[]): number[] {
    const base = Math.floor(days / towns.length);
    const extra = days % towns.length;
    return towns.flatMap((town, i) => Array<number>(base + (i < extra ? 1 : 0)).fill(town));
}

export function addDays(date: string, n: number) {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + n);
    return localDate(d);
}

export async function planVacation(req: PlanRequest): Promise<Trip> {
    const vacation = req.vacation!;
    const locations = await fetchLocations();
    const byId = new Map(locations.map(l => [l.id, l]));
    const perDay = allocateDays(vacation.days, vacation.towns);
    const startDate = req.time_from.slice(0, 10);
    const dailyFrom = vacation.daily_from ?? '09:00:00';

    const days: TripDay[] = [];
    const visited: number[] = [];
    for (let d = 0; d < perDay.length; d++) {
        const town = byId.get(perDay[d]);
        if (!town) throw new Error('Vybraná obec už neexistuje – uprav prosím dovolenou.');
        const date = addDays(startDate, d);
        // První den může začínat "teď", další dny ráno podle zadání
        const from = d === 0 ? req.time_from.slice(11) : dailyFrom;
        const plan = await generatePlan({
            ...req,
            location_id: town.id,
            route_type: 'LOOP',
            time_from: `${date} ${from}`,
            time_to: `${date} ${req.time_to.slice(11)}`,
            exclude_ids: visited,
        });
        days.push({ date, town, plan });
        visited.push(...plan.itinerary.flatMap(i => (i.type === 'poi' && i.poi_id ? [i.poi_id] : [])));
    }

    // Ubytování: jedno pro každý úsek dovolené ve stejné obci
    const stays: Stay[] = [];
    perDay.forEach((townId, d) => {
        const last = stays[stays.length - 1];
        if (last && last.town.id === townId) last.days++;
        else stays.push({ town: byId.get(townId)!, firstDay: d, days: 1, options: [] });
    });
    await Promise.all(stays.map(async s => {
        try {
            s.options = await fetchAccommodation(s.town.lat, s.town.lng, 4);
        } catch {
            s.options = [];
        }
    }));
    return { days, stays };
}

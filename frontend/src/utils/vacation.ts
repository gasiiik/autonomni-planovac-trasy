import type { AccommodationOption, ChosenStay, Location, PlanRequest, PlanResponse } from '../types/api';
import { fetchAccommodation, fetchLocations, generatePlan } from '../services/apiClient';
import { localDate } from './plan';

// Plánování dovolené:
// - víc obcí než dní -> obce se spojí do jednoho dne (výlet přes víc měst),
// - míň obcí než dní -> obec dostane víc dní, a když v ní místa dojdou, přidá se okolí (do 20 km),
// - každý den je okruh z ubytování (v první obci dne), místa se během dovolené neopakují.

export interface TripDay {
    date: string;          // YYYY-MM-DD
    base: Location;        // kde ten den spíme / odkud vyrážíme
    towns: Location[];     // obce, kterými výlet ten den vede (vybrané uživatelem)
    nearby: Location[];    // okolní obce přidané automaticky, když ve vybraných místa došla
    plan: PlanResponse;
}

export interface Stay {
    town: Location;
    firstDay: number;      // index dne, kdy do obce přijedeme
    days: number;          // kolik dní v obci bydlíme (= počet nocí)
    options: AccommodationOption[];
    chosen: ChosenStay | null;      // ubytování vybrané uživatelem (dny se plánují od něj)
}

export interface Trip {
    days: TripDay[];
    stays: Stay[];
}

const NEARBY_KM = 20;
const MIN_STOPS = 5;          // méně zastávek = den je "chudý" -> zkusíme přidat okolí
const MAX_FREE_MINS = 180;    // víc než 3 hodiny volna = taky chudý den

// Rozdělení obcí do dní (v pořadí výběru). Výsledek: pro každý den seznam jeho obcí.
//   5 dní, 2 obce -> [[A], [A], [A], [B], [B]]
//   3 dny, 6 obcí -> [[A, B], [C, D], [E, F]]
export function allocateDays(days: number, towns: number[]): number[][] {
    if (towns.length === 0 || days < 1) return [];
    if (towns.length <= days) {
        const base = Math.floor(days / towns.length);
        const extra = days % towns.length;
        return towns.flatMap((town, i) => Array.from({ length: base + (i < extra ? 1 : 0) }, () => [town]));
    }
    const per = Math.floor(towns.length / days);
    const extra = towns.length % days;
    const groups: number[][] = [];
    let i = 0;
    for (let d = 0; d < days; d++) {
        const size = per + (d < extra ? 1 : 0);
        groups.push(towns.slice(i, i + size));
        i += size;
    }
    return groups;
}

export function addDays(date: string, n: number) {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + n);
    return localDate(d);
}

const distanceKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const toRad = (x: number) => x * Math.PI / 180;
    const h = Math.sin(toRad(b.lat - a.lat) / 2) ** 2
        + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(toRad(b.lng - a.lng) / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
};

const stopCount = (p: PlanResponse) => p.itinerary.filter(i => i.type === 'poi').length;

export async function planVacation(req: PlanRequest): Promise<Trip> {
    const vacation = req.vacation!;
    const locations = await fetchLocations();
    const byId = new Map(locations.map(l => [l.id, l]));
    const groups = allocateDays(vacation.days, vacation.towns);
    const startDate = req.time_from.slice(0, 10);
    const dailyFrom = vacation.daily_from ?? '09:00:00';

    // Ubytování: jedno pro každý úsek dovolené se stejnou obcí, kde se spí (první obec dne).
    // Počítá se předem, aby se dny mohly plánovat od vybraného hotelu.
    const stays: Stay[] = [];
    groups.forEach((group, d) => {
        const town = byId.get(group[0]);
        if (!town) throw new Error('Vybraná obec už neexistuje – uprav prosím dovolenou.');
        const last = stays[stays.length - 1];
        if (last && last.town.id === town.id) last.days++;
        else stays.push({ town, firstDay: d, days: 1, options: [], chosen: vacation.stays?.[String(d)] ?? null });
    });
    const stayOfDay = (d: number) => stays.find(s => d >= s.firstDay && d < s.firstDay + s.days)!;

    const days: TripDay[] = [];
    const visited: number[] = [...(req.exclude_ids ?? [])]; // + místa vyřazená uživatelem ("Vyměnit")
    for (let d = 0; d < groups.length; d++) {
        const towns = groups[d].map(id => byId.get(id)).filter((l): l is Location => !!l);
        const base = towns[0];
        const stay = stayOfDay(d);
        const date = addDays(startDate, d);
        // První den může začínat "teď", další dny ráno podle zadání
        const from = d === 0 ? req.time_from.slice(11) : dailyFrom;
        const dayRequest = (nearbyTowns: Location[]): PlanRequest => ({
            ...req,
            location_id: base.id,
            // Vybrané ubytování: výlet začíná a končí u něj
            ...(stay.chosen ? { start_lat: stay.chosen.lat, start_lng: stay.chosen.lng, start_name: stay.chosen.name } : {}),
            day_town_ids: towns.slice(1).map(l => l.id),       // obce dne - čas se mezi ně rozdělí
            area_location_ids: nearbyTowns.map(l => l.id),     // okolí přidané navíc
            route_type: 'LOOP',
            time_from: `${date} ${from}`,
            time_to: `${date} ${req.time_to.slice(11)}`,
            exclude_ids: visited,
            max_stops: req.max_stops_by_day?.[d] ?? null,      // "Vyměnit" - počet zastávek dne zůstane
            only_ids: req.only_ids_by_day?.[d] ?? null,        // "Odebrat" - den jen ze zbylých zastávek
        });

        let nearby: Location[] = [];
        let plan = await generatePlan(dayRequest([]));
        const limited = req.max_stops_by_day?.[d] != null || req.only_ids_by_day?.[d] != null;
        if (!limited && (stopCount(plan) < MIN_STOPS || plan.remaining_free_time_mins > MAX_FREE_MINS)) {
            // Ve vybraných obcích místa došla -> přidáme nejbližší okolní obce
            nearby = locations
                .filter(l => !towns.some(t => t.id === l.id) && distanceKm(base, l) <= NEARBY_KM)
                .sort((a, b) => distanceKm(base, a) - distanceKm(base, b))
                .slice(0, 6);
            if (nearby.length) {
                const wider = await generatePlan(dayRequest(nearby));
                if (stopCount(wider) > stopCount(plan)) plan = wider;
                else nearby = [];
            }
        }
        days.push({ date, base, towns, nearby, plan });
        visited.push(...plan.itinerary.flatMap(i => (i.type === 'poi' && i.poi_id ? [i.poi_id] : [])));
    }

    await Promise.all(stays.map(async s => {
        try {
            s.options = await fetchAccommodation(s.town.lat, s.town.lng, 5);
        } catch {
            s.options = [];
        }
    }));
    return { days, stays };
}

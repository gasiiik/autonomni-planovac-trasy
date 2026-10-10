// Kategorie míst v DB (backend/engine/app/models.py -> ActivityPOI.category)
export type Category = 'SIGHTSEEING' | 'PARK' | 'FUN' | 'GASTRO' | 'RUNNING' | 'FESTIVAL';

export interface PlanRequest {
    location_id?: number | null;   // výchozí obec, nebo start_lat/start_lng (aktuální poloha)
    start_lat?: number | null;
    start_lng?: number | null;
    start_name?: string | null;
    time_from: string; // "YYYY-MM-DD HH:MM:SS"
    time_to: string;
    transport_mode: 'WALK' | 'BIKE' | 'CAR';
    route_type: 'LOOP' | 'ONE_WAY';
    interests: Category[];
    max_travel_time_mins?: number | null;
    budget_max?: number | null;
    willing_to_pay_entry?: boolean;
    food_preferences?: string[];
    difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
    participants_count?: number;
    has_children?: boolean;
    indoor_when_rain?: boolean;
    exclude_ids?: number[];          // místa navštívená v předchozích dnech dovolené / vyřazená uživatelem
    max_stops?: number | null;       // "Odebrat zastávku" - plán s menším počtem zastávek
    max_stops_by_day?: (number | null)[];
    only_ids?: number[] | null;
    favorite_ids?: number[];          // výlet z oblíbených (jen pro frontend - výměna a obnovení plánu)
    only_ids_by_day?: (number[] | null)[]; // dovolená: max. zastávek pro jednotlivé dny
    area_location_ids?: number[];    // dovolená: hledat i v okolí dalších obcí (automaticky přidané okolí)
    day_town_ids?: number[];         // dovolená: obce, kterými výlet ten den vede (čas dne se rozdělí)
    vacation?: VacationRequest | null; // jen frontend: plán dovolené (backend neznámá pole ignoruje)
}

export interface VacationRequest {
    towns: number[];       // obce v pořadí návštěvy
    days: number;          // délka dovolené ve dnech
    daily_from?: string;   // "HH:MM:SS" - od kdy se plánuje 2. a další dny
    stays?: Record<string, ChosenStay>; // vybrané ubytování podle prvního dne pobytu (klíč = index dne)
}

export interface ChosenStay {
    id: number;
    name: string;
    lat: number;
    lng: number;
}

// Restaurace, kavárny a hospody z OpenStreetMap (vrstva na mapě míst)
export interface FoodPlace {
    id: number;
    name: string;
    kind: string;
    kind_label: string;
    lat: number;
    lng: number;
    cuisine: string | null;
    opening_hours: string | null;
    website: string | null;
    address: string | null;
    vegetarian: boolean;
}

export interface AccommodationOption {
    id: number;
    name: string;
    kind: string;
    kind_label: string;
    lat: number;
    lng: number;
    stars: number | null;
    website: string | null;
    phone: string | null;
    address: string | null;
    distance_km: number;
}

export interface Waypoint {
    lat: number;
    lng: number;
    name: string;
    type: 'START' | 'POI' | 'END_LOOP';
}

export interface ItineraryItem {
    type: 'travel' | 'travel_return' | 'wait' | 'poi';
    start: string;
    end: string;
    duration_mins: number;
    // přesun
    mode?: string;
    distance_km?: number;
    title?: string;
    // zastávka (poi)
    category?: Category;
    lat?: number;
    lng?: number;
    image_url?: string | null;
    estimated_cost?: number;
    address?: string | null;
    website?: string | null;
    description?: string | null;
    source?: DataSource | null; // u míst z DataZápad
    weather?: Weather | null;   // předpověď na začátek návštěvy
    poi_id?: number;
    indoor?: boolean;
}

export interface Weather {
    code: number; // WMO kód počasí
    temp: number | null;
}

export interface Place {
    id: number;
    name: string;
    category: Category;
    lat: number;
    lng: number;
    image_url: string | null;
    price: number;
    indoor: boolean;
    family_friendly: boolean;
    difficulty: string;
    tags: string[];
    source: DataSource | null;
}

export interface PlaceDetail extends Place {
    description: string | null;
    address: string | null;
    website: string | null;
    open_time: string | null;
    close_time: string | null;
    season_from: number | null;
    season_to: number | null;
    est_duration_mins: number | null;
    nearest_location: { id: number; name: string; distance_km: number };
}

export interface DataSource {
    name: string;
    url: string | null;
    license: string | null;
}

export interface PlanResponse {
    status: string;
    empty_reason: string | null;
    message: string;
    weather_status: 'GOOD_WEATHER' | 'BAD_WEATHER' | 'UNKNOWN';
    location: string;
    route_type: string;
    transport_mode: string;
    waypoints: Waypoint[];
    itinerary: ItineraryItem[];
    remaining_free_time_mins: number;
    total_planned_time: number;
    total_estimated_cost: number;
    participants?: number;
}

export interface DatasetInfo {
    title: string;
    url: string | null;
    license: string | null;
    records_total: number | null;
    places_used: number | null;
}

export interface DatasetsResponse {
    datasets: DatasetInfo[];
    places_from_datazapad: number;
    places_manual: number;
    last_import: string | null;
    import_running: boolean;
}

export interface Location {
    id: number;
    name: string;
    lat: number;
    lng: number;
}

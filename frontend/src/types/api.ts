// Kategorie míst v DB (backend/engine/app/models.py -> ActivityPOI.category)
export type Category = 'SIGHTSEEING' | 'PARK' | 'FUN' | 'GASTRO' | 'RUNNING' | 'FESTIVAL';

export interface PlanRequest {
    location_id: number;
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

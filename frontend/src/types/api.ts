export interface PlanRequest {
    location_id: number;
    time_from: string;
    time_to: string;
    transport_mode: string;
    route_type: string;
    interests: string[];
}

export interface Waypoint {
    lat: number;
    lng: number;
    name: string;
    type: string;
}

export interface ItineraryItem {
    type: string;
    start: string;
    end: string;
    mode?: string;
    distance_km?: number;
    duration_mins: number;
    title?: string;
    category?: string;
    lat?: number;
    lng?: number;
}

export interface PlanResponse {
    status: string;
    location: string;
    route_type: string;
    transport_mode: string;
    waypoints: Waypoint[];
    itinerary: ItineraryItem[];
    remaining_free_time_mins: number;
    total_planned_time: number;
}

export interface Location {
    id: number;
    name: string;
    lat: number;
    lng: number;
}

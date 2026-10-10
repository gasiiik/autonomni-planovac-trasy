import type { AccommodationOption, DatasetsResponse, Location, Place, PlaceDetail, PlanRequest, PlanResponse } from '../types/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

// Backend (FastAPI přes PHP gateway) vrací chyby jako {"detail": "..."} nebo {"error": "..."}
async function readError(res: Response, fallback: string): Promise<Error> {
    try {
        const body = await res.json();
        const detail = body.detail ?? body.error;
        if (typeof detail === 'string') return new Error(detail);
        if (Array.isArray(detail)) return new Error('Neplatný požadavek: ' + detail.map((d: { msg: string }) => d.msg).join(', '));
    } catch {
        // tělo není JSON
    }
    return new Error(`${fallback} (HTTP ${res.status})`);
}

export const fetchLocations = async (): Promise<Location[]> => {
    const res = await fetch(`${API_URL}/locations`);
    if (!res.ok) throw await readError(res, 'Nepodařilo se načíst seznam míst');
    const locations: Location[] = await res.json();
    return locations.sort((a, b) => a.name.localeCompare(b.name, 'cs'));
}

export const fetchDatasets = async (): Promise<DatasetsResponse> => {
    const res = await fetch(`${API_URL}/datasets`);
    if (!res.ok) throw await readError(res, 'Nepodařilo se načíst přehled dat');
    return await res.json();
}

export const fetchPlaces = async (): Promise<Place[]> => {
    const res = await fetch(`${API_URL}/places`);
    if (!res.ok) throw await readError(res, 'Nepodařilo se načíst místa');
    return await res.json();
}

export const fetchPlace = async (id: number): Promise<PlaceDetail> => {
    const res = await fetch(`${API_URL}/places/${id}`);
    if (!res.ok) throw await readError(res, 'Nepodařilo se načíst místo');
    return await res.json();
}

export const fetchAccommodation = async (lat: number, lng: number, limit = 4): Promise<AccommodationOption[]> => {
    const res = await fetch(`${API_URL}/accommodation?lat=${lat}&lng=${lng}&limit=${limit}`);
    if (!res.ok) throw await readError(res, 'Nepodařilo se načíst ubytování');
    return await res.json();
}

export const generatePlan = async (request: PlanRequest): Promise<PlanResponse> => {
    const res = await fetch(`${API_URL}/planner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
    });
    if (!res.ok) throw await readError(res, 'Nepodařilo se naplánovat výlet');
    return await res.json();
}

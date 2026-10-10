import type { Location, PlanRequest, PlanResponse } from '../types/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

export const fetchLocations = async (): Promise<Location[]> => {
    try {
        const res = await fetch(`${API_URL}/locations`);
        if (!res.ok) throw new Error('Failed to fetch locations');
        return await res.json();
    } catch (error) {
        console.error(error);
        return [
            { id: 1, name: 'Praha', lat: 50.0755, lng: 14.4378 },
            { id: 2, name: 'Brno', lat: 49.1951, lng: 16.6068 }
        ]; // Fallback pro demonstraci
    }
}

export const generatePlan = async (request: PlanRequest): Promise<PlanResponse> => {
    const res = await fetch(`${API_URL}/planner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
    });
    if (!res.ok) throw new Error('Failed to generate plan');
    return await res.json();
}

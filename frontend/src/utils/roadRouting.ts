type RoutePoint = { lat: number; lng: number };

const ROUTER_PROFILE: Record<string, string> = {
    CAR: 'car',
    BIKE: 'bike',
    WALK: 'foot',
};

const cache = new Map<string, Promise<[number, number][] | null>>();
let nextRequestAt = 0;
let requestQueue = Promise.resolve();

function throttledFetch(url: string) {
    const request = requestQueue.then(async () => {
        const delay = Math.max(0, nextRequestAt - Date.now());
        if (delay) await new Promise(resolve => setTimeout(resolve, delay));
        nextRequestAt = Date.now() + 1000;
        return fetch(url);
    });
    requestQueue = request.then(() => undefined, () => undefined);
    return request;
}

/** Fetch road-following geometry from the public FOSSGIS OSRM routers. */
export function getRoadRoute(points: RoutePoint[], transportMode: string): Promise<[number, number][] | null> {
    if (points.length < 2) return Promise.resolve(null);

    const profile = ROUTER_PROFILE[transportMode] ?? 'car';
    const coordinates = points.map(point => `${point.lng},${point.lat}`).join(';');
    const key = `${profile}:${coordinates}`;
    const cached = cache.get(key);
    if (cached) return cached;

    const url = `https://routing.openstreetmap.de/routed-${profile}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`;
    const result = throttledFetch(url)
        .then(response => {
            if (!response.ok) return null;
            return response.json();
        })
        .then(data => {
            const coordinates = data?.code === 'Ok' ? data.routes?.[0]?.geometry?.coordinates : null;
            if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
            return coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]);
        })
        .catch(() => null);

    cache.set(key, result);
    return result;
}

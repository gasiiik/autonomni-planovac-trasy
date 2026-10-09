import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ItineraryItem, PlanResponse } from '../types/api';
import { generatePlan } from '../services/apiClient';
import { CATEGORY_ICONS, CATEGORY_LABELS, TRANSPORT_ICONS, TRANSPORT_LABELS } from '../constants';
import RouteMap from '../components/RouteMap';

const formatMins = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
};

const WEATHER_STYLES: Record<PlanResponse['weather_status'], string> = {
    GOOD_WEATHER: 'bg-secondary text-primary-dark',
    BAD_WEATHER: 'bg-blue-100 text-blue-900',
    UNKNOWN: 'bg-gray-100 text-gray-700',
};
const WEATHER_ICONS: Record<PlanResponse['weather_status'], string> = {
    GOOD_WEATHER: '☀️',
    BAD_WEATHER: '🌧️',
    UNKNOWN: '🌤️',
};

function TravelItem({ item }: { item: ItineraryItem }) {
    if (item.type === 'wait') {
        return <p className="text-gray-600">⏳ {item.title}</p>;
    }
    const mode = item.mode ?? 'CAR';
    return (
        <p className="text-gray-600">
            {TRANSPORT_ICONS[mode] ?? '🚗'} {item.type === 'travel_return' ? 'Návrat do výchozího bodu' : `Přesun ${TRANSPORT_LABELS[mode]?.toLowerCase() ?? ''}`}
            {' '}· {item.distance_km} km
        </p>
    );
}

function PoiItem({ item, order }: { item: ItineraryItem; order: number }) {
    const [imgFailed, setImgFailed] = useState(false);
    const category = item.category;
    const cost = item.estimated_cost && item.estimated_cost > 0 ? `${Math.round(item.estimated_cost)} Kč` : 'Zdarma';
    return (
        <div>
            {item.image_url && !imgFailed && (
                <img src={item.image_url} alt={item.title} loading="lazy" onError={() => setImgFailed(true)}
                    className="w-full h-48 object-cover rounded-xl mb-3" />
            )}
            <h3 className="text-xl font-bold text-primary-dark">{order}. {item.title}</h3>
            <p className="text-sm text-gray-500 mb-2">
                {category ? `${CATEGORY_ICONS[category] ?? ''} ${CATEGORY_LABELS[category] ?? category}` : ''} · {cost}
            </p>
            {item.address && <p className="text-sm text-gray-600 mb-2">📍 {item.address}</p>}
            {item.description && <p className="text-sm text-gray-700 line-clamp-4">{item.description}</p>}
            {item.website && (
                <a href={item.website} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-sm text-primary font-semibold underline">
                    Web místa
                </a>
            )}
        </div>
    );
}

export default function Result() {
    const [reqStr] = useState(() => sessionStorage.getItem('planRequest'));
    const [result, setResult] = useState<PlanResponse | null>(null);
    const [loading, setLoading] = useState(reqStr !== null);
    const [error, setError] = useState(reqStr ? '' : 'Žádná data k plánování – projdi nejdřív průvodce.');

    useEffect(() => {
        if (!reqStr) return;
        let cancelled = false;
        generatePlan(JSON.parse(reqStr))
            .then(res => { if (!cancelled) setResult(res); })
            .catch(err => { if (!cancelled) setError(err.message); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [reqStr]);

    if (loading) {
        return <div className="flex justify-center items-center h-64 pt-28 text-primary text-xl">Generuji ideální výlet...</div>;
    }

    if (error) {
        return (
            <div className="container mx-auto pt-28 pb-12 px-4 text-center">
                <div className="bg-red-100 text-red-700 p-6 rounded-xl max-w-lg mx-auto mb-6">
                    <p className="font-semibold">{error}</p>
                    {error.includes('HTTP') || error.includes('fetch') ? (
                        <p className="text-sm mt-2">Backend pravděpodobně není dostupný. Zkontrolujte docker kontejnery.</p>
                    ) : null}
                </div>
                <Link to="/wizard" className="text-primary underline">Upravit zadání</Link>
            </div>
        );
    }

    if (!result) return null;

    const stops = result.itinerary.filter(i => i.type === 'poi');
    let stopNo = 0;

    return (
        <div className="container mx-auto pt-28 pb-12 px-4">
            <div className="flex flex-col lg:flex-row gap-8">
                {/* Itinerář */}
                <div className="lg:w-1/2">
                    <h1 className="text-3xl font-bold text-primary-dark mb-4">Tvůj plánovaný výlet: {result.location}</h1>

                    <div className={`p-4 rounded-xl mb-4 ${WEATHER_STYLES[result.weather_status]}`}>
                        {WEATHER_ICONS[result.weather_status]} {result.message}
                    </div>

                    {result.empty_reason ? (
                        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-6 rounded-xl mb-6">
                            <p className="font-semibold mb-2">Výlet se nepodařilo naplánovat</p>
                            <p>{result.empty_reason}</p>
                            <Link to="/wizard" className="inline-block mt-4 text-primary font-semibold underline">Upravit zadání</Link>
                        </div>
                    ) : (
                        <>
                            <div className="bg-secondary p-4 rounded-xl mb-8 grid grid-cols-3 gap-4">
                                <div>
                                    <p className="text-sm text-gray-600">Naplánováno</p>
                                    <p className="font-bold text-primary-dark">{formatMins(result.total_planned_time)}</p>
                                </div>
                                <div title="Čas, který zbyl do konce zvoleného okna – další místo se do něj už nevešlo">
                                    <p className="text-sm text-gray-600">Rezerva</p>
                                    <p className="font-bold text-primary-dark">{formatMins(result.remaining_free_time_mins)}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Odhad nákladů</p>
                                    <p className="font-bold text-primary-dark">{Math.round(result.total_estimated_cost)} Kč</p>
                                </div>
                            </div>

                            <div className="relative border-l-2 border-primary ml-4 pl-8 space-y-6">
                                {result.itinerary.map((item, idx) => (
                                    <div key={idx} className="relative">
                                        {/* Tečka na ose */}
                                        <div className={`absolute -left-[41px] top-1 w-6 h-6 rounded-full border-4 ${item.type === 'poi' ? 'bg-accent border-primary' : 'bg-white border-primary'}`}></div>

                                        <div className={item.type === 'poi' ? 'bg-white p-5 rounded-2xl shadow-sm border border-gray-100' : 'px-1'}>
                                            <div className="flex justify-between mb-2">
                                                <span className="font-bold text-primary-dark">{item.start} – {item.end}</span>
                                                <span className="text-sm bg-secondary text-primary-dark px-2 py-1 rounded">{formatMins(item.duration_mins)}</span>
                                            </div>
                                            {item.type === 'poi' ? <PoiItem item={item} order={++stopNo} /> : <TravelItem item={item} />}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    <div className="mt-8 flex flex-wrap gap-4">
                        <Link to="/wizard" className="px-6 py-3 border border-primary text-primary font-bold rounded-full hover:bg-primary hover:text-white transition">
                            Upravit výlet
                        </Link>
                    </div>
                </div>

                {/* Mapa */}
                <div className="lg:w-1/2">
                    <div className="sticky top-28 rounded-3xl h-[600px] overflow-hidden shadow-lg border border-secondary z-0">
                        <RouteMap waypoints={result.waypoints} />
                    </div>
                    {stops.length > 0 && (
                        <p className="text-xs text-gray-500 mt-2">Trasa je zobrazena vzdušnou čarou mezi zastávkami.</p>
                    )}
                </div>
            </div>
        </div>
    )
}

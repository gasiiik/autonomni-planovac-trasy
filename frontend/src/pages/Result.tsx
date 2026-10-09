import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { ItineraryItem, PlanRequest, PlanResponse } from '../types/api';
import { generatePlan } from '../services/apiClient';
import { CATEGORY_ICONS, CATEGORY_LABELS, TRANSPORT_ICONS, TRANSPORT_LABELS, weatherInfo } from '../constants';
import { decodePlan } from '../utils/plan';
import { downloadIcs } from '../utils/calendar';
import RouteMap from '../components/RouteMap';
import PlaceImage from '../components/PlaceImage';

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

// Typ trasy pro navigaci v Mapy.cz podle zvolené dopravy
const MAPY_ROUTE_TYPE: Record<string, string> = { CAR: 'car_fast', BIKE: 'bike_road', WALK: 'foot_fast' };

const LOADING_STEPS = [
    'Načítám místa z DataZápadu…',
    'Kontroluji předpověď počasí…',
    'Hlídám otevírací dobu a sezónu…',
    'Skládám nejlepší trasu…',
];

function LoadingScreen() {
    const [step, setStep] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setStep(s => Math.min(s + 1, LOADING_STEPS.length - 1)), 700);
        return () => clearInterval(t);
    }, []);
    return (
        <div className="flex flex-col justify-center items-center min-h-[60vh] pt-28 gap-6">
            <div className="w-14 h-14 border-4 border-secondary border-t-primary rounded-full animate-spin" />
            <ul className="space-y-2 text-lg">
                {LOADING_STEPS.map((text, i) => (
                    <li key={text} className={`transition-opacity duration-300 ${i <= step ? 'opacity-100' : 'opacity-0'} ${i < step ? 'text-gray-400' : 'text-primary-dark font-semibold'}`}>
                        {i < step ? '✓' : '•'} {text}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function TravelItem({ item }: { item: ItineraryItem }) {
    if (item.type === 'wait') {
        return <p className="text-gray-500 text-sm">⏳ {item.title}</p>;
    }
    const mode = item.mode ?? 'CAR';
    return (
        <p className="text-gray-500 text-sm">
            {TRANSPORT_ICONS[mode] ?? '🚗'} {item.type === 'travel_return' ? 'Návrat do výchozího bodu' : `Přesun ${TRANSPORT_LABELS[mode]?.toLowerCase() ?? ''}`}
            {' '}· {item.distance_km} km
        </p>
    );
}

function PoiItem({ item, order, transport }: { item: ItineraryItem; order: number; transport: string }) {
    const category = item.category;
    const cost = item.estimated_cost && item.estimated_cost > 0 ? `${Math.round(item.estimated_cost)} Kč` : 'Zdarma';
    const weather = item.weather ? weatherInfo(item.weather.code) : null;
    const navUrl = `https://mapy.cz/fnc/v1/route?end=${item.lng},${item.lat}&routeType=${MAPY_ROUTE_TYPE[transport] ?? 'car_fast'}`;
    return (
        <div>
            <PlaceImage src={item.image_url} alt={item.title ?? ''} category={category} className="w-full h-48 rounded-xl mb-3" />
            <h3 className="text-xl font-bold text-primary-dark">{order}. {item.title}</h3>
            <p className="text-sm text-gray-500 mb-2 flex flex-wrap gap-x-2">
                <span>{category ? `${CATEGORY_ICONS[category] ?? ''} ${CATEGORY_LABELS[category] ?? category}` : ''}</span>
                <span>· {cost}</span>
                {item.indoor && <span>· uvnitř</span>}
                {weather && <span title={`Předpověď na ${item.start}`}>· {weather.icon} {item.weather?.temp != null ? `${item.weather.temp} °C` : weather.label}</span>}
            </p>
            {item.address && <p className="text-sm text-gray-600 mb-2">📍 {item.address}</p>}
            {item.description && <p className="text-sm text-gray-700 line-clamp-3">{item.description}</p>}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm font-semibold print:hidden">
                {item.poi_id && <Link to={`/misto/${item.poi_id}`} className="text-primary underline">Detail</Link>}
                <a href={navUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">Navigovat (Mapy.cz)</a>
                {item.website && <a href={item.website} target="_blank" rel="noopener noreferrer" className="text-primary underline">Web místa</a>}
            </div>
            {item.source && (
                <p className="mt-3 pt-2 border-t border-gray-100 text-xs text-gray-500">
                    Zdroj:{' '}
                    {item.source.url ? (
                        <a href={item.source.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">{item.source.name}</a>
                    ) : item.source.name}
                    {item.source.license ? ` (${item.source.license})` : ''}
                </p>
            )}
        </div>
    );
}

// Plán z URL (?plan=..., sdílitelný odkaz), starší verze ukládala požadavek do session storage
function readRequest(params: URLSearchParams): PlanRequest | null {
    const encoded = params.get('plan');
    if (encoded) return decodePlan(encoded);
    try {
        const legacy = sessionStorage.getItem('planRequest');
        return legacy ? JSON.parse(legacy) : null;
    } catch {
        return null;
    }
}

export default function Result() {
    const [searchParams] = useSearchParams();
    const [request] = useState(() => readRequest(searchParams));
    const [result, setResult] = useState<PlanResponse | null>(null);
    const [loading, setLoading] = useState(request !== null);
    const [error, setError] = useState(request ? '' : 'Žádná data k plánování – projdi nejdřív průvodce.');
    const [activeStop, setActiveStop] = useState<number | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!request) return;
        let cancelled = false;
        generatePlan(request)
            .then(res => { if (!cancelled) setResult(res); })
            .catch(err => { if (!cancelled) setError(err.message); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [request]);

    // Klik na značku v mapě -> posun seznamu na zastávku
    const selectStop = useCallback((n: number) => {
        setActiveStop(n);
        document.getElementById(`stop-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, []);

    const share = async () => {
        try {
            if (navigator.share) {
                await navigator.share({ title: `Výlet: ${result?.location}`, url: window.location.href });
                return;
            }
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch {
            // uživatel sdílení zrušil
        }
    };

    if (loading) return <LoadingScreen />;

    if (error) {
        return (
            <div className="container mx-auto pt-28 pb-12 px-4 text-center">
                <div className="bg-red-100 text-red-700 p-6 rounded-xl max-w-lg mx-auto mb-6">
                    <p className="font-semibold">{error}</p>
                    {error.includes('HTTP') || error.includes('fetch') || error.includes('nedostupný') ? (
                        <p className="text-sm mt-2">Backend pravděpodobně není dostupný. Zkontrolujte docker kontejnery.</p>
                    ) : null}
                </div>
                <Link to="/wizard" className="text-primary underline">Upravit zadání</Link>
            </div>
        );
    }

    if (!result || !request) return null;

    const stops = result.itinerary.filter(i => i.type === 'poi');
    const totalKm = result.itinerary.reduce((sum, i) => sum + (i.distance_km ?? 0), 0);
    const date = request.time_from.slice(0, 10);
    let stopNo = 0;

    return (
        <div className="container mx-auto pt-28 pb-12 px-4">
            <div className="flex flex-col lg:flex-row gap-8">
                {/* Itinerář */}
                <div className="lg:w-1/2">
                    <p className="text-gray-500">{new Date(date).toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })} · {TRANSPORT_ICONS[request.transport_mode]} {TRANSPORT_LABELS[request.transport_mode]}</p>
                    <h1 className="text-3xl font-bold text-primary-dark mb-4">Tvůj výlet: {result.location}</h1>

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
                            {/* Souhrn */}
                            <div className="bg-primary text-white p-5 rounded-2xl mb-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center shadow-md">
                                <div><p className="text-2xl font-extrabold">{stops.length}</p><p className="text-sm text-white/80">zastávek</p></div>
                                <div><p className="text-2xl font-extrabold">{Math.round(totalKm)} km</p><p className="text-sm text-white/80">celkem</p></div>
                                <div><p className="text-2xl font-extrabold">{formatMins(result.total_planned_time)}</p><p className="text-sm text-white/80">naplánováno</p></div>
                                <div><p className="text-2xl font-extrabold">{Math.round(result.total_estimated_cost)} Kč</p><p className="text-sm text-white/80">odhad nákladů</p></div>
                            </div>
                            {result.remaining_free_time_mins > 0 && (
                                <p className="text-sm text-gray-500 mb-6" title="Čas, který zbyl do konce zvoleného okna – další místo se do něj už nevešlo">
                                    Rezerva do konce dne: {formatMins(result.remaining_free_time_mins)}
                                </p>
                            )}

                            {/* Akce */}
                            <div className="flex flex-wrap gap-3 mb-8 print:hidden">
                                <button onClick={share} className="px-5 py-2 rounded-full bg-secondary text-primary-dark font-semibold hover:bg-primary hover:text-white transition">
                                    {copied ? '✓ Odkaz zkopírován' : '🔗 Sdílet'}
                                </button>
                                <button onClick={() => downloadIcs(result, date)} className="px-5 py-2 rounded-full bg-secondary text-primary-dark font-semibold hover:bg-primary hover:text-white transition">
                                    📅 Do kalendáře
                                </button>
                                <button onClick={() => window.print()} className="px-5 py-2 rounded-full bg-secondary text-primary-dark font-semibold hover:bg-primary hover:text-white transition">
                                    🖨️ Tisk
                                </button>
                            </div>

                            <div className="relative border-l-2 border-primary/40 ml-4 pl-8 space-y-4">
                                {result.itinerary.map((item, idx) => {
                                    const isPoi = item.type === 'poi';
                                    const n = isPoi ? ++stopNo : 0;
                                    return (
                                        <div key={idx} id={isPoi ? `stop-${n}` : undefined} className="relative"
                                            onMouseEnter={isPoi ? () => setActiveStop(n) : undefined}>
                                            {/* Tečka na ose */}
                                            {isPoi
                                                ? <div className={`absolute -left-[47px] top-4 w-8 h-8 rounded-full border-4 flex items-center justify-center text-xs font-bold transition ${activeStop === n ? 'bg-accent border-primary-dark text-primary-dark scale-110' : 'bg-primary border-accent text-white'}`}>{n}</div>
                                                : <div className="absolute -left-[39px] top-1.5 w-4 h-4 rounded-full bg-white border-2 border-primary/40" />}

                                            <div className={isPoi
                                                ? `bg-white p-5 rounded-2xl shadow-sm border-2 transition ${activeStop === n ? 'border-primary shadow-lg' : 'border-gray-100'}`
                                                : 'px-1 py-1'}>
                                                <div className="flex justify-between mb-2">
                                                    <span className={isPoi ? 'font-bold text-primary-dark' : 'text-sm text-gray-500'}>{item.start} – {item.end}</span>
                                                    <span className={isPoi ? 'text-sm bg-secondary text-primary-dark px-2 py-1 rounded' : 'text-xs text-gray-400'}>{formatMins(item.duration_mins)}</span>
                                                </div>
                                                {isPoi ? <PoiItem item={item} order={n} transport={request.transport_mode} /> : <TravelItem item={item} />}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    <div className="mt-8 flex flex-wrap gap-4 print:hidden">
                        <Link to="/wizard" className="px-6 py-3 border border-primary text-primary font-bold rounded-full hover:bg-primary hover:text-white transition">
                            Upravit výlet
                        </Link>
                    </div>
                </div>

                {/* Mapa */}
                <div className="lg:w-1/2 print:hidden">
                    <div className="sticky top-28 rounded-3xl h-[450px] lg:h-[calc(100vh-8rem)] overflow-hidden shadow-lg border border-secondary z-0">
                        <RouteMap waypoints={result.waypoints} activeStop={activeStop} onSelectStop={selectStop} />
                    </div>
                    {stops.length > 0 && (
                        <p className="text-xs text-gray-500 mt-2">Trasa je zobrazena vzdušnou čarou. Najetím na zastávku ji zvýrazníte na mapě.</p>
                    )}
                </div>
            </div>
        </div>
    )
}

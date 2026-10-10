import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { ItineraryItem, PlanRequest, PlanResponse } from '../types/api';
import { generatePlan } from '../services/apiClient';
import { CalendarDays, CalendarPlus, Check, Clock, CloudRain, CloudSun, ExternalLink, MapPin, Navigation, Printer, Share2, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CATEGORY_LABELS, TRANSPORT_LABELS } from '../constants';
import { CategoryTag, TransportIcon, WeatherIcon } from '../components/Icons';
import { decodePlan } from '../utils/plan';
import { downloadIcs } from '../utils/calendar';
import { applePlaceNavUrl, appleRouteUrl, googlePlaceNavUrl, googleRouteUrl, mapyPlaceNavUrl, mapyRouteUrl, tooManyForGoogle } from '../utils/navigation';
import { cityEventsUrl, townFromStartName, EVENTS_CALENDAR_URL } from '../utils/events';
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
const WEATHER_ICONS: Record<PlanResponse['weather_status'], LucideIcon> = {
    GOOD_WEATHER: Sun,
    BAD_WEATHER: CloudRain,
    UNKNOWN: CloudSun,
};

const NAV_BTN = 'inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-primary text-white font-semibold hover:bg-primary-dark transition';
const MAP_BTN = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/95 text-primary-dark text-sm font-semibold shadow-md hover:bg-primary hover:text-white transition';
const ACTION_BTN = 'inline-flex items-center gap-2 px-5 py-2 rounded-full bg-secondary text-primary-dark font-semibold hover:bg-primary hover:text-white transition';

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
                        <span className="inline-flex items-center gap-2">
                            {i < step ? <Check size={18} strokeWidth={3} aria-hidden="true" /> : <span className="w-2 h-2 rounded-full bg-primary inline-block mx-[5px]" />}
                            {text}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function TravelItem({ item }: { item: ItineraryItem }) {
    if (item.type === 'wait') {
        return <p className="text-gray-500 text-sm flex items-center gap-1.5"><Clock size={16} aria-hidden="true" /> {item.title}</p>;
    }
    const mode = item.mode ?? 'CAR';
    return (
        <p className="text-gray-500 text-sm flex items-center gap-1.5">
            <TransportIcon mode={mode} size={16} /> {item.type === 'travel_return' ? 'Návrat do výchozího bodu' : `Přesun ${TRANSPORT_LABELS[mode]?.toLowerCase() ?? ''}`}
            {' '}· {item.distance_km} km
        </p>
    );
}

function PoiItem({ item, order, transport }: { item: ItineraryItem; order: number; transport: string }) {
    const category = item.category;
    const cost = item.estimated_cost && item.estimated_cost > 0 ? `${Math.round(item.estimated_cost)} Kč` : 'Zdarma';
    return (
        <div>
            <PlaceImage src={item.image_url} alt={item.title ?? ''} category={category} className="w-full h-48 rounded-xl mb-3" />
            <h3 className="text-xl font-bold text-primary-dark">{order}. {item.title}</h3>
            <p className="text-sm text-gray-500 mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                {category && <CategoryTag category={category} label={CATEGORY_LABELS[category] ?? category} />}
                <span>· {cost}</span>
                {item.indoor && <span>· uvnitř</span>}
                {item.weather && (
                    <span className="inline-flex items-center gap-1" title={`Předpověď na ${item.start}`}>
                        · <WeatherIcon code={item.weather.code} size={16} />{item.weather.temp != null ? ` ${item.weather.temp} °C` : ''}
                    </span>
                )}
            </p>
            {item.address && <p className="text-sm text-gray-600 mb-2 flex items-start gap-1.5"><MapPin size={16} className="text-primary mt-0.5 shrink-0" aria-hidden="true" /> {item.address}</p>}
            {item.description && <p className="text-sm text-gray-700 line-clamp-3">{item.description}</p>}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm font-semibold print:hidden">
                {item.poi_id && <Link to={`/misto/${item.poi_id}`} className="text-primary underline">Detail</Link>}
                {item.lat != null && item.lng != null && (
                    <span className="inline-flex items-center gap-x-2 text-gray-500 font-normal">
                        <Navigation size={14} className="text-primary" aria-hidden="true" /> Navigovat:
                        <a href={googlePlaceNavUrl(item.lat, item.lng, transport)} target="_blank" rel="noopener noreferrer" className="text-primary font-semibold underline">Google Maps</a>
                        <a href={mapyPlaceNavUrl(item.lat, item.lng, transport)} target="_blank" rel="noopener noreferrer" className="text-primary font-semibold underline">Mapy.cz</a>
                        <a href={applePlaceNavUrl(item.lat, item.lng, transport)} target="_blank" rel="noopener noreferrer" className="text-primary font-semibold underline">Apple Mapy</a>
                    </span>
                )}
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
    // Čekání na otevření (např. při odjezdu v noci) nepočítáme do času výletu
    const waitMins = result.itinerary.filter(i => i.type === 'wait').reduce((sum, i) => sum + i.duration_mins, 0);
    const date = request.time_from.slice(0, 10);
    let stopNo = 0;

    return (
        <div className="container mx-auto pt-28 pb-12 px-4">
            <div className="flex flex-col lg:flex-row gap-8">
                {/* Itinerář */}
                <div className="lg:w-1/2">
                    <p className="text-gray-500">{new Date(date).toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })} · {TRANSPORT_LABELS[request.transport_mode].toLowerCase()}</p>
                    <h1 className="text-3xl font-bold text-primary-dark mb-4">Tvůj výlet: {result.location}</h1>

                    <div className={`p-4 rounded-xl mb-4 flex items-start gap-3 ${WEATHER_STYLES[result.weather_status]}`}>
                        {(() => { const Icon = WEATHER_ICONS[result.weather_status]; return <Icon size={22} className="shrink-0 mt-0.5" aria-hidden="true" />; })()}
                        <span>{result.message}</span>
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
                                <div><p className="text-2xl font-extrabold">{formatMins(result.total_planned_time - waitMins)}</p><p className="text-sm text-white/80">naplánováno</p></div>
                                <div><p className="text-2xl font-extrabold">{Math.round(result.total_estimated_cost)} Kč</p><p className="text-sm text-white/80">odhad nákladů</p></div>
                            </div>
                            {result.remaining_free_time_mins > 0 && (
                                <p className="text-sm text-gray-500 mb-6" title="Čas, který zbyl do konce zvoleného okna – další místo se do něj už nevešlo">
                                    Rezerva do konce dne: {formatMins(result.remaining_free_time_mins)}
                                </p>
                            )}

                            {/* Celá trasa v navigaci */}
                            <div className="bg-white border-2 border-primary rounded-2xl p-4 mb-4 print:hidden">
                                <p className="font-semibold text-primary-dark mb-3 flex items-center gap-2">
                                    <Navigation size={18} className="text-primary" aria-hidden="true" /> Spustit celou trasu v navigaci
                                </p>
                                <div className="flex flex-wrap gap-3">
                                    <a href={googleRouteUrl(result.waypoints, request.transport_mode)} target="_blank" rel="noopener noreferrer" className={NAV_BTN}>Google Maps</a>
                                    <a href={mapyRouteUrl(result.waypoints, request.transport_mode)} target="_blank" rel="noopener noreferrer" className={NAV_BTN}>Mapy.cz</a>
                                    <a href={appleRouteUrl(result.waypoints, request.transport_mode)} target="_blank" rel="noopener noreferrer" className={NAV_BTN}>Apple Mapy</a>
                                </div>
                                {tooManyForGoogle(result.waypoints) && (
                                    <p className="text-xs text-gray-500 mt-2">Google Maps v odkazu zobrazí jen prvních 9 zastávek, Mapy.cz a Apple Mapy až 15.</p>
                                )}
                            </div>

                            {/* Akce */}
                            <div className="flex flex-wrap gap-3 mb-8 print:hidden">
                                <button onClick={share} className={ACTION_BTN}>
                                    {copied ? <Check size={18} aria-hidden="true" /> : <Share2 size={18} aria-hidden="true" />}
                                    {copied ? 'Odkaz zkopírován' : 'Sdílet'}
                                </button>
                                <button onClick={() => downloadIcs(result, date)} className={ACTION_BTN}>
                                    <CalendarPlus size={18} aria-hidden="true" /> Do kalendáře
                                </button>
                                <button onClick={() => window.print()} className={ACTION_BTN}>
                                    <Printer size={18} aria-hidden="true" /> Tisk
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

                    {/* Akce v obci startu - odkaz do oficiálního kalendáře kraje */}
                    {(() => {
                        const town = townFromStartName(result.location);
                        const url = cityEventsUrl(town) ?? EVENTS_CALENDAR_URL;
                        return (
                            <a href={url} target="_blank" rel="noopener noreferrer"
                                className="mt-8 flex items-center gap-4 p-5 rounded-2xl bg-secondary hover:bg-primary group transition print:hidden">
                                <span className="flex items-center justify-center w-12 h-12 rounded-xl bg-white text-primary shrink-0">
                                    <CalendarDays size={24} aria-hidden="true" />
                                </span>
                                <span className="flex-1">
                                    <span className="block font-bold text-primary-dark group-hover:text-white">
                                        {cityEventsUrl(town) ? `Co se děje v obci ${town}?` : 'Co se děje v kraji?'}
                                    </span>
                                    <span className="block text-sm text-gray-600 group-hover:text-white/85">
                                        Festivaly, koncerty a další akce v kalendáři Karlovarského kraje Kam na západě
                                    </span>
                                </span>
                                <ExternalLink size={18} className="text-primary group-hover:text-white shrink-0" aria-hidden="true" />
                            </a>
                        );
                    })()}

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
                        {stops.length > 0 && (
                            <div className="absolute top-3 right-3 z-[1000] flex gap-2">
                                <a href={googleRouteUrl(result.waypoints, request.transport_mode)} target="_blank" rel="noopener noreferrer" className={MAP_BTN}>
                                    <Navigation size={14} aria-hidden="true" /> Google
                                </a>
                                <a href={mapyRouteUrl(result.waypoints, request.transport_mode)} target="_blank" rel="noopener noreferrer" className={MAP_BTN}>
                                    <Navigation size={14} aria-hidden="true" /> Mapy.cz
                                </a>
                                <a href={appleRouteUrl(result.waypoints, request.transport_mode)} target="_blank" rel="noopener noreferrer" className={MAP_BTN}>
                                    <Navigation size={14} aria-hidden="true" /> Apple
                                </a>
                            </div>
                        )}
                    </div>
                    {stops.length > 0 && (
                        <p className="text-xs text-gray-500 mt-2">Trasa je zobrazena vzdušnou čarou. Najetím na zastávku ji zvýrazníte na mapě.</p>
                    )}
                </div>
            </div>
        </div>
    )
}

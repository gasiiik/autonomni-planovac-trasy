import { useCallback, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { AccommodationOption, ChosenStay, ItineraryItem, PlanRequest, PlanResponse } from '../types/api';
import { generatePlan } from '../services/apiClient';
import { BedDouble, CalendarDays, CalendarPlus, Check, Clock, CloudRain, CloudSun, ExternalLink, Info, MapPin, Navigation, Printer, RefreshCw, RotateCcw, Share2, Sun, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CATEGORY_LABELS, DAY_COLORS, TRANSPORT_LABELS } from '../constants';
import { CategoryTag, TransportIcon, WeatherIcon } from '../components/Icons';
import { decodePlan, encodePlan, tripKey } from '../utils/plan';
import { saveTrip, useUser } from '../services/account';
import { downloadIcs, downloadTripIcs } from '../utils/calendar';
import { applePlaceNavUrl, appleRouteUrl, googlePlaceNavUrl, googleRouteUrl, mapyPlaceNavUrl, mapyRouteUrl, tooManyForGoogle } from '../utils/navigation';
import { cityEventsUrl, townFromStartName, EVENTS_CALENDAR_URL } from '../utils/events';
import { planVacation } from '../utils/vacation';
import type { Stay, Trip, TripDay } from '../utils/vacation';
import RouteMap from '../components/RouteMap';
import TripOverviewMap from '../components/TripOverviewMap';
import PlaceImage from '../components/PlaceImage';
import FavoriteButton from '../components/FavoriteButton';

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

interface StopActions {
    onSwap: (item: ItineraryItem) => void;
    onRemove: (item: ItineraryItem) => void;
}

function PoiItem({ item, order, transport, people, actions }: { item: ItineraryItem; order: number; transport: string; people: number; actions: StopActions | null }) {
    const category = item.category;
    const cost = item.estimated_cost && item.estimated_cost > 0
        ? `${Math.round(item.estimated_cost)} Kč${people > 1 ? ` za ${people} os.` : ''}`
        : 'Zdarma';
    return (
        <div>
            <div className="relative">
                <PlaceImage src={item.image_url} alt={item.title ?? ''} category={category} className="w-full h-48 rounded-xl mb-3" />
                {item.poi_id != null && item.poi_id > 0 && category && item.lat != null && item.lng != null && (
                    <FavoriteButton className="absolute top-3 right-3 shadow"
                        place={{ id: item.poi_id, name: item.title ?? '', category, lat: item.lat, lng: item.lng, image_url: item.image_url ?? null }} />
                )}
            </div>
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
                {item.poi_id != null && item.poi_id > 0 && <Link to={`/misto/${item.poi_id}`} className="text-primary underline">Detail</Link>}
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
            {actions && item.poi_id != null && (
                <div className="flex flex-wrap gap-2 mt-3 print:hidden">
                    <button onClick={() => actions.onSwap(item)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary text-primary text-sm font-semibold hover:bg-primary hover:text-white transition">
                        <RefreshCw size={14} aria-hidden="true" /> Vyměnit za jiné místo
                    </button>
                    <button onClick={() => actions.onRemove(item)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-300 text-gray-600 text-sm font-semibold hover:border-red-600 hover:text-red-700 transition">
                        <Trash2 size={14} aria-hidden="true" /> Odebrat zastávku
                    </button>
                </div>
            )}
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

// Nabídka ubytování v obci (OpenStreetMap)
function StayCard({ stay, onChoose }: { stay: Stay; onChoose: (a: AccommodationOption | null) => void }) {
    const nights = stay.days;
    const chosenId = stay.chosen?.id ?? null;
    return (
        <div className="bg-white border-2 border-accent rounded-2xl p-5 mb-4">
            <p className="font-bold text-primary-dark flex items-center gap-2 mb-1">
                <BedDouble size={20} className="text-primary" aria-hidden="true" /> Ubytování v obci {stay.town.name}
            </p>
            <p className="text-sm text-gray-500 mb-3">
                {nights} {nights === 1 ? 'noc' : nights < 5 ? 'noci' : 'nocí'} · tipy z OpenStreetMap seřazené podle vzdálenosti od centra
            </p>
            {stay.chosen ? (
                <p className="text-sm text-primary-dark mb-3 flex items-center gap-2">
                    <Check size={16} className="text-primary" aria-hidden="true" />
                    Bydlíš v: <strong>{stay.chosen.name}</strong> – výlety v obci {stay.town.name} začínají a končí tady.
                </p>
            ) : stay.options.length > 0 && (
                <p className="text-sm text-gray-600 mb-3">Vyber si ubytování a dny v obci {stay.town.name} naplánujeme od něj.</p>
            )}
            {stay.options.length === 0 ? (
                <p className="text-sm text-gray-600">V okolí jsme ubytování nenašli – zkus{' '}
                    <a href={`https://mapy.cz/zakladni?q=${encodeURIComponent('ubytování ' + stay.town.name)}`} target="_blank" rel="noopener noreferrer" className="text-primary underline">hledání na Mapy.cz</a>.
                </p>
            ) : (
                <ul className="space-y-2">
                    {stay.options.map(a => (
                        <li key={a.id} className={`flex items-start justify-between gap-3 p-3 rounded-xl ${a.id === chosenId ? 'bg-primary/10 ring-2 ring-primary' : 'bg-secondary/60'}`}>
                            <div className="min-w-0">
                                <p className="font-semibold text-primary-dark truncate">{a.name}</p>
                                <p className="text-xs text-gray-600">
                                    {a.kind_label}{a.stars ? ` · ${'★'.repeat(a.stars)}` : ''} · {a.distance_km} km od centra
                                    {a.address ? ` · ${a.address}` : ''}
                                </p>
                            </div>
                            <div className="flex flex-wrap justify-end items-center gap-x-3 gap-y-1 shrink-0 text-sm font-semibold">
                                {a.website && <a href={a.website} target="_blank" rel="noopener noreferrer" className="text-primary underline">Web</a>}
                                <a href={`https://mapy.cz/zakladni?q=${encodeURIComponent(a.name + ' ' + stay.town.name)}`} target="_blank" rel="noopener noreferrer" className="text-primary underline">Mapa</a>
                                <button onClick={() => onChoose(a.id === chosenId ? null : a)}
                                    className={`px-3 py-1 rounded-full transition print:hidden ${a.id === chosenId ? 'bg-primary text-white hover:bg-primary-dark' : 'bg-white text-primary border border-primary hover:bg-primary hover:text-white'}`}
                                    title={a.id === chosenId ? 'Zrušit výběr' : 'Plánovat dny od tohoto ubytování'}>
                                    {a.id === chosenId ? 'Vybráno' : 'Bydlet tady'}
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

// Počasí dne pro záložku: ikona z první zastávky s předpovědí a nejvyšší teplota
function DayWeather({ plan }: { plan: PlanResponse }) {
    const withWeather = plan.itinerary.filter(i => i.weather);
    if (!withWeather.length) {
        if (plan.weather_status === 'UNKNOWN') return null;
        const Icon = WEATHER_ICONS[plan.weather_status];
        return <Icon size={15} aria-hidden="true" />;
    }
    const temps = withWeather.map(i => i.weather?.temp).filter((t): t is number => t != null);
    return (
        <span className="inline-flex items-center gap-1 font-normal" title="Předpověď počasí">
            <WeatherIcon code={withWeather[0].weather!.code} size={15} />
            {temps.length > 0 && `${Math.round(Math.max(...temps))} °C`}
        </span>
    );
}

// Celá dovolená na papír / do PDF - všechny dny pod sebou (zobrazí se jen při tisku)
function TripPrint({ trip, people }: { trip: Trip; people: number }) {
    const stayOf = (d: number) => trip.stays.find(s => d >= s.firstDay && d < s.firstDay + s.days);
    return (
        <div className="hidden print:block text-black">
            <h1 className="text-2xl font-bold mb-1">Dovolená · {trip.days.length} {trip.days.length === 1 ? 'den' : trip.days.length < 5 ? 'dny' : 'dní'}</h1>
            <p className="mb-4 text-sm">
                Bydlení: {trip.stays.map(s => `${s.town.name}${s.chosen ? ` (${s.chosen.name})` : ''}`).join(' → ')}
                {people > 1 ? ` · ${people} osoby` : ''}
                {' '}· vstupné celkem {Math.round(trip.days.reduce((n, d) => n + d.plan.total_estimated_cost, 0))} Kč
            </p>
            {trip.days.map((d: TripDay, i) => {
                const stay = stayOf(i);
                return (
                    <section key={d.date} className="mb-5 break-inside-avoid">
                        <h2 className="text-lg font-bold border-b border-gray-400 mb-1">
                            Den {i + 1} · {new Date(d.date).toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })} · {d.towns.map(t => t.name).join(' + ')}
                        </h2>
                        <p className="text-xs mb-1">Start a návrat: {stay?.chosen?.name ?? `ubytování v obci ${d.base.name}`} · {d.plan.message}</p>
                        {d.plan.empty_reason ? <p className="text-sm">{d.plan.empty_reason}</p> : (
                            <ol className="text-sm space-y-0.5">
                                {d.plan.itinerary.filter(it => it.type === 'poi').map((it, k) => (
                                    <li key={k}>
                                        <strong>{it.start}–{it.end}</strong> {it.title}
                                        {it.address ? `, ${it.address}` : ''}
                                        {it.estimated_cost ? ` · ${Math.round(it.estimated_cost)} Kč` : ''}
                                    </li>
                                ))}
                            </ol>
                        )}
                    </section>
                );
            })}
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

// Úprava plánu (výměna, odebrání zastávky, výběr ubytování) mění ?plan= v URL -> plán se spočítá znovu
export default function Result() {
    const [searchParams] = useSearchParams();
    return <ResultView key={searchParams.get('plan') ?? ''} />;
}

function ResultView() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [request] = useState(() => readRequest(searchParams));
    const [single, setSingle] = useState<PlanResponse | null>(null);
    const [trip, setTrip] = useState<Trip | null>(null);       // dovolená (více dní)
    const [activeDay, setActiveDay] = useState(() => Math.max(0, parseInt(searchParams.get('day') ?? '0') || 0));
    const [printAll, setPrintAll] = useState(false);
    const user = useUser();
    const [loading, setLoading] = useState(request !== null);
    const [error, setError] = useState(request ? '' : 'Žádná data k plánování – projdi nejdřív průvodce.');
    const [activeStop, setActiveStop] = useState<number | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!request) return;
        let cancelled = false;
        const work = request.vacation?.towns?.length
            ? planVacation(request).then(t => {
                if (cancelled) return;
                setTrip(t);
                setActiveDay(d => Math.min(d, t.days.length - 1));
            })
            : generatePlan(request).then(res => { if (!cancelled) setSingle(res); });
        work
            .catch(err => { if (!cancelled) setError(err.message); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [request]);

    const tripDay = trip?.days[activeDay] ?? null;
    const result = tripDay?.plan ?? single;
    // Pro přehledovou mapu jen jednou (jinak by se překreslovala při každém najetí myší)
    const overviewDays = useMemo(() => trip?.days.map(d => d.plan.waypoints) ?? [], [trip]);

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

    // Přihlášený uživatel: výlet se uloží do "Moje výlety" (upravená verze přepíše původní záznam)
    const planParam = searchParams.get('plan');
    useEffect(() => {
        if (!user || !request || !planParam || (!single && !trip)) return;
        const count = (p: PlanResponse) => p.itinerary.filter(i => i.type === 'poi').length;
        if (trip) {
            saveTrip({ key: tripKey(request), kind: 'vacation', plan: planParam, days: trip.days.length,
                title: `Dovolená: ${trip.stays.map(s => s.town.name).join(' → ')}`, trip_date: trip.days[0]?.date ?? request.time_from.slice(0, 10),
                stops: trip.days.reduce((n, d) => n + count(d.plan), 0) }).catch(() => undefined);
        } else if (single && !single.empty_reason) {
            saveTrip({ key: tripKey(request), kind: 'trip', plan: planParam, days: 1,
                title: `${request.favorite_ids ? 'Výlet z oblíbených' : 'Výlet'}: ${single.location}`, trip_date: request.time_from.slice(0, 10),
                stops: count(single) }).catch(() => undefined);
        }
    }, [user, request, planParam, single, trip]);

    // Nový plán = nová URL (sdílitelná), u dovolené zůstaneme na stejném dni
    const openPlan = (next: PlanRequest) => {
        const base = next.vacation ? '/dovolena/vysledek' : '/result';
        navigate(`${base}?plan=${encodePlan(next)}${next.vacation ? `&day=${activeDay}` : ''}`);
    };

    const currentIds = (result?.itinerary ?? []).flatMap(i => (i.type === 'poi' && i.poi_id != null ? [i.poi_id] : []));
    // Úprava jednoho dne dovolené (ostatní dny nechá, jak jsou nastavené)
    const perDay = <T,>(list: (T | null)[] | undefined, value: T | null) => {
        const out: (T | null)[] = (trip?.days ?? []).map((_, d) => list?.[d] ?? null);
        out[activeDay] = value;
        return out;
    };
    const stopActions: StopActions | null = request ? {
        // Výměna: místo vyřadíme, počet zastávek zůstane -> plánovač doplní jiné místo
        // Výměna: ostatní zastávky zůstanou, za vybranou plánovač najde náhradu poblíž
        onSwap: item => {
            const swap = { swap_id: item.poi_id!, keep_ids: currentIds };
            const excluded = [...(request.exclude_ids ?? []), item.poi_id!];   // vyměněné místo se už nevrátí
            openPlan(request.vacation
                ? { ...request, exclude_ids: excluded, swap_by_day: perDay(request.swap_by_day, swap), only_ids_by_day: perDay(request.only_ids_by_day, null), max_stops_by_day: perDay(request.max_stops_by_day, null) }
                : { ...request, ...swap, exclude_ids: excluded, max_stops: null, order_ids: null, only_ids: request.favorite_ids ?? null });
        },
        // Odebrání: plán jen ze zbylých zastávek, nic nového se nedoplní (časy se přepočítají)
        onRemove: item => {
            const rest = currentIds.filter(id => id !== item.poi_id);
            if (!rest.length) return;
            openPlan(request.vacation
                ? { ...request, only_ids_by_day: perDay(request.only_ids_by_day, rest), max_stops_by_day: perDay(request.max_stops_by_day, null), swap_by_day: perDay(request.swap_by_day, null) }
                : { ...request, only_ids: rest, order_ids: rest, max_stops: null, swap_id: null, keep_ids: null });
        },
    } : null;
    const edited = !!request && (!!request.exclude_ids?.length || request.max_stops != null
        || (!!request.only_ids?.length && request.only_ids.length !== request.favorite_ids?.length)
        || request.swap_id != null || !!request.swap_by_day?.some(n => n != null)
        || !!request.max_stops_by_day?.some(n => n != null) || !!request.only_ids_by_day?.some(n => n != null));
    const resetEdits = () => request && openPlan({ ...request, exclude_ids: [], max_stops: null, only_ids: request.favorite_ids ?? null, order_ids: null, swap_id: null, keep_ids: null, max_stops_by_day: [], only_ids_by_day: [], swap_by_day: [] });

    const chooseStay = (stay: Stay, a: AccommodationOption | null) => {
        if (!request?.vacation) return;
        const stays: Record<string, ChosenStay> = { ...(request.vacation.stays ?? {}) };
        if (a) stays[String(stay.firstDay)] = { id: a.id, name: a.name, lat: a.lat, lng: a.lng };
        else delete stays[String(stay.firstDay)];
        openPlan({ ...request, vacation: { ...request.vacation, stays } });
    };

    // Tisk celé dovolené: nejdřív vykreslit všechny dny, pak tisk (window.print blokuje do zavření dialogu)
    const printTrip = () => {
        flushSync(() => setPrintAll(true));
        window.print();
        setPrintAll(false);
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
                <Link to={request?.vacation ? '/dovolena' : '/wizard'} className="text-primary underline">Upravit zadání</Link>
            </div>
        );
    }

    if (!result || !request) return null;

    const stops = result.itinerary.filter(i => i.type === 'poi');
    const totalKm = result.itinerary.reduce((sum, i) => sum + (i.distance_km ?? 0), 0);
    // Čekání na otevření (např. při odjezdu v noci) nepočítáme do času výletu
    const waitMins = result.itinerary.filter(i => i.type === 'wait').reduce((sum, i) => sum + i.duration_mins, 0);
    const date = tripDay?.date ?? request.time_from.slice(0, 10);
    const stay = trip?.stays.find(s => activeDay >= s.firstDay && activeDay < s.firstDay + s.days) ?? null;
    const people = result.participants ?? request.participants_count ?? 1;
    let stopNo = 0;

    return (
        <div className="container mx-auto pt-28 pb-12 px-4">
            {trip && printAll && <TripPrint trip={trip} people={people} />}
            <div className={`flex flex-col lg:flex-row gap-8 ${printAll ? 'print:hidden' : ''}`}>
                {/* Itinerář */}
                <div className="lg:w-1/2">
                    {trip && (
                        <div className="mb-6 print:hidden">
                            <p className="text-sm font-semibold uppercase tracking-widest text-primary">Dovolená · {trip.days.length} {trip.days.length === 1 ? 'den' : trip.days.length < 5 ? 'dny' : 'dní'}</p>
                            <p className="text-gray-600 mt-1 mb-4">Bydlení: {trip.stays.map(s => `${s.town.name} (${s.days} ${s.days === 1 ? 'noc' : s.days < 5 ? 'noci' : 'nocí'})`).join(' → ')}</p>
                            {/* Přehled celé dovolené */}
                            <div className="bg-primary text-white p-5 rounded-2xl mb-4 grid grid-cols-3 gap-4 text-center shadow-md">
                                <div><p className="text-2xl font-extrabold">{trip.days.reduce((n, d) => n + d.plan.itinerary.filter(i => i.type === 'poi').length, 0)}</p><p className="text-sm text-white/80">míst celkem</p></div>
                                <div><p className="text-2xl font-extrabold">{Math.round(trip.days.reduce((n, d) => n + d.plan.itinerary.reduce((k, i) => k + (i.distance_km ?? 0), 0), 0))} km</p><p className="text-sm text-white/80">na cestách</p></div>
                                <div><p className="text-2xl font-extrabold">{Math.round(trip.days.reduce((n, d) => n + d.plan.total_estimated_cost, 0))} Kč</p><p className="text-sm text-white/80">vstupné celkem{people > 1 ? ` (${people} os.)` : ''}</p></div>
                            </div>
                            <div className="flex flex-wrap gap-3 mb-4">
                                <button onClick={() => downloadTripIcs(trip.days.map(d => ({ plan: d.plan, date: d.date })), trip.stays.map(s => s.town.name).join(', '))} className={ACTION_BTN}>
                                    <CalendarPlus size={18} aria-hidden="true" /> Celá dovolená do kalendáře
                                </button>
                                <button onClick={printTrip} className={ACTION_BTN}>
                                    <Printer size={18} aria-hidden="true" /> Celá dovolená do PDF / tisk
                                </button>
                            </div>
                            <div className="h-72 rounded-2xl overflow-hidden border border-secondary mb-2 relative z-0">
                                <TripOverviewMap days={overviewDays} onSelectDay={d => { setActiveDay(d); setActiveStop(null); }} />
                            </div>
                            <p className="text-xs text-gray-500 mb-4">Každý den má jinou barvu, žluté body jsou ubytování. Kliknutím na trasu otevřeš daný den.</p>
                            <div className="flex flex-wrap gap-2" role="tablist">
                                {trip.days.map((d, i) => (
                                    <button key={d.date} role="tab" aria-selected={i === activeDay}
                                        onClick={() => { setActiveDay(i); setActiveStop(null); }}
                                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition ${i === activeDay ? 'bg-primary text-white' : 'bg-secondary text-primary-dark hover:bg-primary/20'}`}>
                                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: DAY_COLORS[i % DAY_COLORS.length] }} />
                                        Den {i + 1} · {new Date(d.date).toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' })}
                                        <DayWeather plan={d.plan} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <p className="text-gray-500">{new Date(date).toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })} · {TRANSPORT_LABELS[request.transport_mode].toLowerCase()}</p>
                    <h1 className="text-3xl font-bold text-primary-dark mb-2">
                        {tripDay ? `Den ${activeDay + 1}: ${tripDay.towns.map(t => t.name).join(' + ')}` : `Tvůj výlet: ${result.location}`}
                    </h1>
                    {request.favorite_ids && <p className="text-sm text-gray-600 mb-3">Výlet z tvých oblíbených míst ({request.favorite_ids.length}). Co se do dne nevešlo nebo má zavřeno, jsme vynechali.</p>}
                    {tripDay && tripDay.nearby.length > 0 && (
                        <p className="text-sm text-gray-600 mb-3">
                            V {tripDay.towns.length > 1 ? 'vybraných obcích' : `obci ${tripDay.base.name}`} už program došel, proto jsme přidali i okolí: {tripDay.nearby.map(t => t.name).join(', ')}.
                        </p>
                    )}
                    {tripDay && <p className="text-sm text-gray-500 mb-4">Start a návrat: {stay?.chosen ? stay.chosen.name : `ubytování v obci ${tripDay.base.name}`}</p>}

                    {stay && stay.firstDay === activeDay && <StayCard stay={stay} onChoose={a => chooseStay(stay, a)} />}
                    {stay && stay.firstDay !== activeDay && (
                        <p className="text-sm text-gray-600 mb-4 flex items-center gap-2">
                            <BedDouble size={16} className="text-primary" aria-hidden="true" />
                            Bydlíš dál v obci {stay.town.name}{stay.chosen ? ` (${stay.chosen.name})` : ''} – ubytování {stay.chosen ? 'změníš' : 'vybereš'} u dne {stay.firstDay + 1}.
                        </p>
                    )}

                    <div className={`p-4 rounded-xl mb-4 flex items-start gap-3 ${WEATHER_STYLES[result.weather_status]}`}>
                        {(() => { const Icon = WEATHER_ICONS[result.weather_status]; return <Icon size={22} className="shrink-0 mt-0.5" aria-hidden="true" />; })()}
                        <span>{result.message}</span>
                    </div>

                    {result.notice && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl mb-4 flex items-start gap-3 print:hidden">
                            <Info size={20} className="shrink-0 mt-0.5" aria-hidden="true" />
                            <span>{result.notice}</span>
                        </div>
                    )}
                    {result.empty_reason ? (
                        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-6 rounded-xl mb-6">
                            <p className="font-semibold mb-2">Výlet se nepodařilo naplánovat</p>
                            <p>{result.empty_reason}</p>
                            <Link to={request?.vacation ? '/dovolena' : '/wizard'} className="inline-block mt-4 text-primary font-semibold underline">Upravit zadání</Link>
                        </div>
                    ) : (
                        <>
                            {/* Souhrn */}
                            <div className="bg-primary text-white p-5 rounded-2xl mb-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center shadow-md">
                                <div><p className="text-2xl font-extrabold">{stops.length}</p><p className="text-sm text-white/80">zastávek</p></div>
                                <div><p className="text-2xl font-extrabold">{Math.round(totalKm)} km</p><p className="text-sm text-white/80">celkem</p></div>
                                <div><p className="text-2xl font-extrabold">{formatMins(result.total_planned_time - waitMins)}</p><p className="text-sm text-white/80">naplánováno</p></div>
                                <div><p className="text-2xl font-extrabold">{Math.round(result.total_estimated_cost)} Kč</p><p className="text-sm text-white/80">{people > 1 ? `odhad za ${people} os.` : 'odhad nákladů'}</p></div>
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
                                    <Printer size={18} aria-hidden="true" /> {trip ? 'Tisk dne' : 'Tisk / PDF'}
                                </button>
                                {edited && (
                                    <button onClick={resetEdits} className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-primary text-primary font-semibold hover:bg-primary hover:text-white transition">
                                        <RotateCcw size={18} aria-hidden="true" /> Obnovit původní plán
                                    </button>
                                )}
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
                                                {isPoi ? <PoiItem item={item} order={n} transport={request.transport_mode} people={people} actions={stopActions} /> : <TravelItem item={item} />}
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
                        <Link to={request?.vacation ? '/dovolena' : '/wizard'} className="px-6 py-3 border border-primary text-primary font-bold rounded-full hover:bg-primary hover:text-white transition">
                            {request.vacation ? 'Upravit dovolenou' : 'Upravit výlet'}
                        </Link>
                    </div>
                </div>

                {/* Mapa */}
                <div className="lg:w-1/2 print:hidden">
                    <div className="sticky top-28 rounded-3xl h-[450px] lg:h-[calc(100vh-8rem)] overflow-hidden shadow-lg border border-secondary z-0">
                        <RouteMap key={activeDay} waypoints={result.waypoints} activeStop={activeStop} onSelectStop={selectStop} />
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

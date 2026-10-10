import { useState, useEffect } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Category, Location, PlanRequest } from '../types/api';
import { fetchLocations } from '../services/apiClient';
import { CalendarRange, Check, LocateFixed, MapPin, Sun, X } from 'lucide-react';
import { DIFFICULTY_LABELS, TRANSPORT_LABELS } from '../constants';
import { CategoryBadge, TransportIcon } from '../components/Icons';
import LocationPicker from '../components/LocationPicker';
import { addDays, allocateDays } from '../utils/vacation';
import { defaultTimes, localDate, normalizeTimes, nowRounded, resultUrl } from '../utils/plan';

const STEPS = 6;

// Zájmy = kategorie míst v backendu (data z DataZápad)
const INTERESTS: { value: Category; label: string; hint: string }[] = [
    { value: 'SIGHTSEEING', label: 'Památky', hint: 'hrady, zámky, muzea, rozhledny, prameny' },
    { value: 'PARK', label: 'Příroda', hint: 'přírodní pozoruhodnosti, zahrady, arboreta' },
    { value: 'FUN', label: 'Zábava a sport', hint: 'ZOO, aquaparky, lanová centra, golf, lyžování, koně' },
];
const ALL_INTERESTS: Category[] = ['SIGHTSEEING', 'PARK', 'FUN'];

const FOOD_PREFERENCES = [
    { value: 'PIVOVAR', label: 'Pivovar' },
    { value: 'CAFE', label: 'Kavárna' },
    { value: 'VEGETARIAN', label: 'Vegetariánské' },
];

const inputClass = 'w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-primary';

// Poloha uživatele (start "odsud") - obec se pak nevybírá
interface StartPosition { lat: number; lng: number; name: string }

const distanceKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const toRad = (x: number) => x * Math.PI / 180;
    const h = Math.sin(toRad(b.lat - a.lat) / 2) ** 2
        + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(toRad(b.lng - a.lng) / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
};

interface WizardForm {
    location_id: string;
    start?: StartPosition | null;
    mode?: 'trip' | 'vacation';    // jednodenní výlet / dovolená
    vacation_days?: string;
    vacation_towns?: string[];     // obce v pořadí návštěvy
    date: string;
    time_from: string;
    time_to: string;
    transport_mode: PlanRequest['transport_mode'];
    route_type: PlanRequest['route_type'];
    interests: Category[];
    gastro: boolean;
    food_preferences: string[];
    willing_to_pay_entry: boolean;
    budget_max: string;
    max_travel_time_mins: string;
    difficulty: NonNullable<PlanRequest['difficulty']>;
    has_children: boolean;
    indoor_when_rain: boolean;
}

function initialForm(presetLocation: string | null): WizardForm {
    // Návrat z výsledku přes "Upravit výlet" -> předvyplníme poslední zadání
    try {
        const saved = sessionStorage.getItem('wizardForm');
        if (saved) {
            const form: WizardForm = JSON.parse(saved);
            // Staré zadání (jiný den nebo čas, který už proběhl) -> aktuální časy
            const fresh = form.date < localDate(new Date()) ? { ...form, ...defaultTimes() } : normalizeTimes(form);
            // Výchozí místo se nepamatuje (obec, poloha ani obce dovolené) - uživatel ho vždy vybere sám.
            // Výjimka: "Naplánovat výlet odsud" z detailu místa obec předvyplní.
            return { ...fresh, start: null, location_id: presetLocation ?? '', vacation_towns: [] };
        }
    } catch {
        // poškozená data v session storage ignorujeme
    }
    return {
        location_id: presetLocation ?? '',
        ...defaultTimes(),
        transport_mode: 'CAR',
        route_type: 'LOOP',
        interests: [],
        gastro: true,
        food_preferences: [],
        willing_to_pay_entry: true,
        budget_max: '',
        max_travel_time_mins: '',
        difficulty: 'MEDIUM',
        has_children: false,
        indoor_when_rain: false,
        start: null,
        mode: 'trip',
        vacation_days: '5',
        vacation_towns: [],
    };
}

const MAX_VACATION_DAYS = 14;

function toPlanRequest(f: WizardForm, dailyFrom?: string): PlanRequest {
    const interests = f.interests.length > 0 ? [...f.interests] : [...ALL_INTERESTS];
    if (f.gastro) interests.push('GASTRO');
    const vacation = f.mode === 'vacation'
        ? {
            towns: (f.vacation_towns ?? []).map(Number),
            days: Math.min(MAX_VACATION_DAYS, Math.max(1, parseInt(f.vacation_days ?? '1') || 1)),
            daily_from: `${dailyFrom ?? f.time_from}:00`,
        }
        : null;
    return {
        vacation,
        ...(vacation
            ? { location_id: vacation.towns[0] }
            : f.start
                ? { start_lat: f.start.lat, start_lng: f.start.lng, start_name: f.start.name }
                : { location_id: parseInt(f.location_id) }),
        time_from: `${f.date} ${f.time_from}:00`,
        time_to: `${f.date} ${f.time_to}:00`,
        transport_mode: f.transport_mode,
        route_type: vacation ? 'LOOP' : f.route_type, // na dovolené každý den okruh z ubytování
        interests,
        food_preferences: f.gastro ? f.food_preferences : [],
        willing_to_pay_entry: f.willing_to_pay_entry,
        budget_max: f.budget_max === '' ? null : parseFloat(f.budget_max),
        max_travel_time_mins: f.max_travel_time_mins === '' ? null : parseInt(f.max_travel_time_mins),
        difficulty: f.difficulty,
        has_children: f.has_children,
        indoor_when_rain: f.indoor_when_rain ?? false,
    };
}

export default function Wizard() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [step, setStep] = useState(1);
    const [locations, setLocations] = useState<Location[]>([]);
    const [locationsError, setLocationsError] = useState('');
    const [stepError, setStepError] = useState('');
    const [formData, setFormData] = useState<WizardForm>(() => initialForm(searchParams.get('location')));
    const [locating, setLocating] = useState(false);

    // "Vyrazit z mé polohy" - poloha z prohlížeče, název podle nejbližší obce
    const useMyLocation = () => {
        setStepError('');
        if (!navigator.geolocation) return setStepError('Prohlížeč neumí zjistit polohu – vyber prosím obec.');
        setLocating(true);
        navigator.geolocation.getCurrentPosition(pos => {
            setLocating(false);
            const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            const nearest = [...locations].sort((a, b) => distanceKm(here, a) - distanceKm(here, b))[0];
            if (nearest && distanceKm(here, nearest) > 40) {
                return setStepError('Jsi mimo Karlovarský kraj – KrušnoPlán plánuje výlety po kraji. Vyber prosím výchozí obec.');
            }
            const name = nearest ? `Vaše poloha (u obce ${nearest.name})` : 'Vaše poloha';
            setFormData(prev => ({ ...prev, start: { ...here, name }, location_id: '' }));
        }, err => {
            setLocating(false);
            setStepError(err.code === err.PERMISSION_DENIED
                ? 'Přístup k poloze je zakázaný – povol ho v prohlížeči, nebo vyber obec.'
                : 'Polohu se nepodařilo zjistit – vyber prosím obec.');
        }, { enableHighAccuracy: true, timeout: 10000 });
    };

    useEffect(() => {
        fetchLocations()
            .then(setLocations)
            .catch(err => setLocationsError(err.message + ' – běží backend (docker compose up)?'));
    }, []);

    // Časy opravujeme až po opuštění pole - při psaní z klávesnice by oprava skákala pod ruku
    const fixTimes = () => setFormData(prev => normalizeTimes(prev));

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        setStepError('');
        setFormData(prev => {
            if (name === 'interests' || name === 'food_preferences') {
                const list = prev[name] as string[];
                return { ...prev, [name]: checked ? [...list, value] : list.filter(i => i !== value) };
            }
            if (type === 'checkbox') return { ...prev, [name]: checked };
            if (name === 'willing_to_pay_entry') return { ...prev, willing_to_pay_entry: value === 'yes' };
            // Změna data -> hned opravíme časy (dnes nejde odjíždět v minulosti)
            if (name === 'date') return normalizeTimes({ ...prev, date: value });
            return { ...prev, [name]: value };
        });
    };

    const isVacation = formData.mode === 'vacation';
    const vacationDays = parseInt(formData.vacation_days ?? '') || 0;
    const vacationTowns = formData.vacation_towns ?? [];
    const townName = (id: string) => locations.find(l => String(l.id) === id)?.name ?? '…';

    const setMode = (mode: 'trip' | 'vacation') => {
        setStepError('');
        setFormData(prev => mode === prev.mode ? prev : mode === 'vacation'
            // Dovolená: časy jsou "denně od-do", typicky od zítřka 9:00-18:00
            ? { ...prev, mode, date: prev.date <= localDate(new Date()) ? addDays(localDate(new Date()), 1) : prev.date, time_from: '09:00', time_to: '18:00', start: null }
            : { ...prev, mode });
    };

    const validateStep = (): string => {
        if (step === 1 && isVacation && (vacationDays < 1 || vacationDays > MAX_VACATION_DAYS)) {
            return `Délka dovolené musí být 1 až ${MAX_VACATION_DAYS} dní.`;
        }
        if (step === 2 && isVacation) {
            if (vacationTowns.length === 0) return 'Vyber aspoň jednu obec, kterou chceš navštívit.';
            if (vacationTowns.length > vacationDays * 3) return `Na ${vacationDays} dní je to moc obcí – vyber nejvýš ${vacationDays * 3} (3 za den), nebo prodluž dovolenou.`;
            return '';
        }
        if (step === 1) {
            if (formData.time_to <= formData.time_from) return 'Čas návratu musí být později než čas odjezdu.';
            const start = new Date(`${formData.date}T${formData.time_from}`);
            if (start < new Date()) return 'Tento čas už proběhl – vyber pozdější čas nebo jiný den.';
        }
        if (step === 2 && !isVacation && !formData.location_id && !formData.start) return 'Vyber výchozí obec, nebo použij svou polohu.';
        return '';
    };

    const nextStep = () => {
        const err = validateStep();
        if (err) return setStepError(err);
        setStep(s => Math.min(s + 1, STEPS));
    };
    const prevStep = () => { setStepError(''); setStep(s => Math.max(s - 1, 1)); };

    const handleSubmit = () => {
        // Mezitím mohl čas odjezdu proběhnout (průvodce byl dlouho otevřený) -> posuneme na teď
        const dailyFrom = formData.time_from; // u dovolené start 2. a dalších dní (1. den může začínat "teď")
        const form = normalizeTimes(formData);
        sessionStorage.setItem('wizardForm', JSON.stringify(form));
        navigate(resultUrl(toPlanRequest(form, dailyFrom)));
    };

    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (step === STEPS) handleSubmit();
        else nextStep();
    };

    const locationName = formData.start?.name ?? locations.find(l => String(l.id) === formData.location_id)?.name;

    return (
        <div className="container mx-auto pt-28 pb-12 px-4 max-w-3xl">
            <div className="mb-8">
                <p className="text-primary-dark font-medium mb-2">Krok {step} z {STEPS}</p>
                <div className="w-full bg-secondary rounded-full h-2.5">
                    <div className="bg-primary h-2.5 rounded-full transition-all duration-300" style={{ width: `${(step / STEPS) * 100}%` }}></div>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-lg p-8 border border-secondary">
                <form onSubmit={onSubmit}>

                    {step === 1 && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-primary-dark">Krok 1 – Čas a datum</h2>
                            <div className="grid grid-cols-2 gap-3">
                                {([['trip', 'Jednodenní výlet', Sun], ['vacation', 'Dovolená', CalendarRange]] as const).map(([mode, label, Icon]) => (
                                    <button key={mode} type="button" onClick={() => setMode(mode)} aria-pressed={(formData.mode ?? 'trip') === mode}
                                        className={`flex items-center justify-center gap-2 p-4 rounded-2xl border-2 font-semibold transition ${(formData.mode ?? 'trip') === mode ? 'border-primary bg-secondary text-primary-dark' : 'border-gray-200 text-gray-600 hover:border-primary'}`}>
                                        <Icon size={22} className="text-primary" aria-hidden="true" /> {label}
                                    </button>
                                ))}
                            </div>
                            <div className={isVacation ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : ''}>
                            <div>
                                <label className="block text-primary-dark mb-2">{isVacation ? 'Datum příjezdu' : 'Datum výletu'}</label>
                                <input type="date" name="date" min={localDate(new Date())} value={formData.date} onChange={handleChange} className={inputClass} required />
                            </div>
                            {isVacation && (
                                <div>
                                    <label className="block text-primary-dark mb-2">Počet dní</label>
                                    <input type="number" name="vacation_days" min="1" max={MAX_VACATION_DAYS} value={formData.vacation_days ?? ''} onChange={handleChange} className={inputClass} required />
                                </div>
                            )}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-primary-dark mb-2">{isVacation ? 'Výlety denně od' : 'Čas odjezdu'}</label>
                                    <input type="time" name="time_from" value={formData.time_from} onChange={handleChange} onBlur={fixTimes}
                                        min={formData.date === localDate(new Date()) ? nowRounded() : undefined} className={inputClass} required />
                                </div>
                                <div>
                                    <label className="block text-primary-dark mb-2">{isVacation ? 'do' : 'Čas návratu'}</label>
                                    <input type="time" name="time_to" value={formData.time_to} onChange={handleChange} onBlur={fixTimes}
                                        min={formData.time_from} className={inputClass} required />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-primary-dark">Krok 2 – Výchozí místo a doprava</h2>
                            <div>
                                <label className="block text-primary-dark mb-2">{isVacation ? 'Které obce chceš navštívit?' : 'Výchozí místo'}</label>
                                {isVacation && !locationsError ? (
                                    <div>
                                        {vacationTowns.length > 0 && (
                                            <ol className="flex flex-wrap gap-2 mb-3">
                                                {vacationTowns.map((id, i) => (
                                                    <li key={id} className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full bg-secondary text-primary-dark font-semibold">
                                                        <span className="text-xs text-primary">{i + 1}.</span> {townName(id)}
                                                        <button type="button" aria-label={`Odebrat ${townName(id)}`} className="text-gray-500 hover:text-primary-dark"
                                                            onClick={() => setFormData(prev => ({ ...prev, vacation_towns: (prev.vacation_towns ?? []).filter(t => t !== id) }))}>
                                                            <X size={16} />
                                                        </button>
                                                    </li>
                                                ))}
                                            </ol>
                                        )}
                                        <LocationPicker
                                            locations={locations.filter(l => !vacationTowns.includes(String(l.id)))}
                                            value=""
                                            onSelect={id => { setStepError(''); setFormData(prev => ({ ...prev, vacation_towns: [...(prev.vacation_towns ?? []), id] })); }}
                                            onClearStart={() => undefined}
                                        />
                                        {vacationTowns.length > 0 && vacationDays > 0 && vacationTowns.length <= vacationDays * 3 && (
                                            <div className="mt-3 rounded-xl bg-secondary/60 p-3">
                                                <p className="text-sm font-semibold text-primary-dark flex items-center gap-1.5 mb-1">
                                                    <MapPin size={15} className="text-primary" aria-hidden="true" /> Rozvrh dovolené
                                                </p>
                                                <ol className="text-sm text-gray-700 space-y-0.5">
                                                    {allocateDays(vacationDays, vacationTowns.map(Number)).map((group, d) => (
                                                        <li key={d}><span className="text-gray-500">Den {d + 1}:</span> {group.map(id => townName(String(id))).join(' + ')}</li>
                                                    ))}
                                                </ol>
                                            </div>
                                        )}
                                        <p className="text-sm text-gray-500 mt-2">
                                            Obce navštívíme v pořadí výběru. Když vybereš víc obcí než dní, spojíme je do jednoho výletu přes víc měst.
                                            Když míň, budeme v obci víc dní a dojde-li tam program, přidáme okolní obce. U každé obce, kde bydlíš, nabídneme ubytování.
                                        </p>
                                    </div>
                                ) : locationsError ? (
                                    <p className="bg-red-100 text-red-700 p-3 rounded-xl">{locationsError}</p>
                                ) : (
                                    <LocationPicker
                                        locations={locations}
                                        value={formData.location_id}
                                        startName={formData.start?.name}
                                        onSelect={id => { setStepError(''); setFormData(prev => ({ ...prev, location_id: id, start: null })); }}
                                        onClearStart={() => setFormData(prev => ({ ...prev, start: null }))}
                                    />
                                )}
                                {!isVacation && !formData.start && !locationsError && (
                                    <button type="button" onClick={useMyLocation} disabled={locating || !locations.length}
                                        title="Nepovinné – místo obce můžeš vyrazit z místa, kde právě jsi"
                                        className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition disabled:opacity-60">
                                        <LocateFixed size={18} aria-hidden="true" /> {locating ? 'Zjišťuji polohu…' : 'Vyrazit z mé polohy'}
                                    </button>
                                )}
                            </div>
                            <div>
                                <label className="block text-primary-dark mb-2">Způsob dopravy</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {(['CAR', 'BIKE', 'WALK'] as const).map(mode => (
                                        <label key={mode} className={`flex flex-col items-center gap-1 p-4 rounded-2xl border-2 cursor-pointer transition ${formData.transport_mode === mode ? 'border-primary bg-secondary' : 'border-gray-200 hover:border-primary'}`}>
                                            <input type="radio" name="transport_mode" value={mode} checked={formData.transport_mode === mode} onChange={handleChange} className="sr-only" />
                                            <TransportIcon mode={mode} size={34} className="text-primary" />
                                            <span className="font-semibold">{TRANSPORT_LABELS[mode]}</span>
                                        </label>
                                    ))}
                                </div>
                                <p className="text-sm text-gray-500 mt-2">Pěšky hledáme do 3 km, na kole do 15 km a autem do 40 km od startu.</p>
                            </div>
                            {/* Na dovolené je každý den okruh z ubytování - volba návratu nemá smysl */}
                            {!isVacation && (
                            <div>
                                <label className="block text-primary-dark mb-2">Návrat</label>
                                <div className="flex flex-wrap gap-4">
                                    <label className="flex items-center space-x-2">
                                        <input type="radio" name="route_type" value="LOOP" checked={formData.route_type === 'LOOP'} onChange={handleChange} className="text-primary focus:ring-primary" />
                                        <span>Vrátit se zpět (Okruh)</span>
                                    </label>
                                    <label className="flex items-center space-x-2">
                                        <input type="radio" name="route_type" value="ONE_WAY" checked={formData.route_type === 'ONE_WAY'} onChange={handleChange} className="text-primary focus:ring-primary" />
                                        <span>Jednosměrný výlet</span>
                                    </label>
                                </div>
                            </div>
                            )}
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-primary-dark">Krok 3 – Co chceš zažít?</h2>
                            <p className="text-gray-600">Vyber, co tě zajímá, nebo nic nevybírej a necháš se překvapit.</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {INTERESTS.map(interest => {
                                    const active = formData.interests.includes(interest.value);
                                    return (
                                        <label key={interest.value} className={`relative flex flex-col items-center text-center gap-2 p-5 rounded-2xl border-2 cursor-pointer transition ${active ? 'border-primary bg-secondary' : 'border-gray-200 hover:border-primary'}`}>
                                            <input type="checkbox" name="interests" value={interest.value} checked={active} onChange={handleChange} className="sr-only" />
                                            {active && <Check size={20} strokeWidth={3} className="absolute top-3 right-3 text-primary" aria-hidden="true" />}
                                            <CategoryBadge category={interest.value} size={56} />
                                            <span className="font-bold text-primary-dark">{interest.label}</span>
                                            <span className="text-sm text-gray-500">{interest.hint}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-primary-dark">Krok 4 – Jídlo a pití</h2>
                            <p className="text-gray-600">Oběd naplánujeme mezi 11:30 a 14:00 a nikdy nedáme dvě jídla hned po sobě.</p>
                            <label className="flex items-center space-x-3 p-4 border rounded-xl hover:bg-secondary cursor-pointer transition">
                                <input type="checkbox" name="gastro" checked={formData.gastro} onChange={handleChange} className="text-primary focus:ring-primary h-5 w-5 rounded" />
                                <span>Zahrnout zastávku na jídlo</span>
                            </label>
                            {formData.gastro && (
                                <div>
                                    <p className="text-primary-dark mb-2">Preference (nepovinné)</p>
                                    <div className="flex flex-wrap gap-3">
                                        {FOOD_PREFERENCES.map(pref => (
                                            <label key={pref.value} className="flex items-center space-x-2 px-4 py-2 border rounded-full hover:bg-secondary cursor-pointer transition">
                                                <input type="checkbox" name="food_preferences" value={pref.value} checked={formData.food_preferences.includes(pref.value)} onChange={handleChange} className="text-primary focus:ring-primary rounded" />
                                                <span>{pref.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 5 && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-primary-dark">Krok 5 – Rozpočet a další preference</h2>
                            <div>
                                <label className="block text-primary-dark mb-2">Ochota platit vstupné</label>
                                <select name="willing_to_pay_entry" value={formData.willing_to_pay_entry ? 'yes' : 'no'} onChange={handleChange} className={inputClass}>
                                    <option value="yes">Ano, chci vidět vše</option>
                                    <option value="no">Ne, pouze zdarma</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-primary-dark mb-2">Maximální útrata (Kč)</label>
                                    <input type="number" name="budget_max" min="0" step="50" placeholder="bez omezení" value={formData.budget_max} onChange={handleChange} className={inputClass} />
                                </div>
                                <div>
                                    <label className="block text-primary-dark mb-2">Max. čas na cestě (min)</label>
                                    <input type="number" name="max_travel_time_mins" min="0" step="10" placeholder="bez omezení" value={formData.max_travel_time_mins} onChange={handleChange} className={inputClass} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-primary-dark mb-2">Náročnost</label>
                                <select name="difficulty" value={formData.difficulty} onChange={handleChange} className={inputClass}>
                                    <option value="EASY">Lehká – jen snadno dostupná místa</option>
                                    <option value="MEDIUM">Střední – i rozhledny a lanová centra</option>
                                    <option value="HARD">Náročná – cokoliv</option>
                                </select>
                            </div>
                            <label className="flex items-center space-x-3 p-4 border rounded-xl hover:bg-secondary cursor-pointer transition">
                                <input type="checkbox" name="has_children" checked={formData.has_children} onChange={handleChange} className="text-primary focus:ring-primary h-5 w-5 rounded" />
                                <span>Jedu s dětmi</span>
                            </label>
                            <label className="flex items-center space-x-3 p-4 border rounded-xl hover:bg-secondary cursor-pointer transition">
                                <input type="checkbox" name="indoor_when_rain" checked={formData.indoor_when_rain ?? false} onChange={handleChange} className="text-primary focus:ring-primary h-5 w-5 rounded" />
                                <span>Když bude pršet, chci jen místa uvnitř <span className="block text-sm text-gray-500">Jinak plán nezměníme, jen tě na déšť upozorníme.</span></span>
                            </label>
                        </div>
                    )}

                    {step === 6 && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-primary-dark">Krok 6 – Shrnutí</h2>
                            <div className="bg-secondary p-6 rounded-xl space-y-2">
                                {isVacation && (
                                    <p><strong>Dovolená:</strong> {vacationDays} {vacationDays === 1 ? 'den' : vacationDays < 5 ? 'dny' : 'dní'} – {vacationTowns.map(townName).join(' → ')}</p>
                                )}
                                <p><strong>{isVacation ? 'Příjezd:' : 'Datum:'}</strong> {new Date(formData.date).toLocaleDateString('cs-CZ')}</p>
                                <p><strong>Čas:</strong> {formData.time_from} – {formData.time_to}</p>
                                {!isVacation && <p><strong>Start:</strong> {locationName ?? '–'}</p>}
                                <p><strong>Doprava:</strong> {TRANSPORT_LABELS[formData.transport_mode]}, {formData.route_type === 'LOOP' ? 'okruh' : 'jednosměrně'}</p>
                                <p><strong>Zájmy:</strong> {formData.interests.length ? INTERESTS.filter(i => formData.interests.includes(i.value)).map(i => i.label).join(', ') : 'Překvap mě'}{formData.gastro ? ' + jídlo' : ''}</p>
                                <p><strong>Vstupné:</strong> {formData.willing_to_pay_entry ? 'ano' : 'jen zdarma'}{formData.budget_max ? `, max. ${formData.budget_max} Kč` : ''}</p>
                                <p><strong>Náročnost:</strong> {DIFFICULTY_LABELS[formData.difficulty]}{formData.has_children ? ', s dětmi' : ''}</p>
                            </div>
                        </div>
                    )}

                    {stepError && <p className="mt-6 bg-red-100 text-red-700 p-3 rounded-xl">{stepError}</p>}

                    <div className="mt-8 flex justify-between">
                        {step > 1 ? (
                            <button type="button" onClick={prevStep} className="px-6 py-3 border border-primary text-primary font-bold rounded-full hover:bg-primary hover:text-white transition">
                                Zpět
                            </button>
                        ) : <div></div>}

                        <button type="submit" className="px-8 py-3 bg-accent text-primary-dark font-bold rounded-full hover:bg-yellow-400 transition shadow-md">
                            {step === STEPS ? 'Vytvořit výlet' : 'Pokračovat'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

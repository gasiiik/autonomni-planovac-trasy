import { useState, useEffect } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Category, Location, PlanRequest } from '../types/api';
import { fetchLocations } from '../services/apiClient';
import { ArrowRight, Check, MapPin, Repeat, X } from 'lucide-react';
import { ALL_INTERESTS, DIFFICULTY_LABELS, FOOD_PREFERENCES, INTERESTS, TRANSPORT_LABELS } from '../constants';
import { CategoryBadge } from '../components/Icons';
import AddressSearch from '../components/AddressSearch';
import CarProgress from '../components/CarProgress';
import TransportPicker from '../components/TransportPicker';
import { ChoiceCard, NumberField } from '../components/FormControls';
import { currentTimes, localDate, normalizeTimes, nowRounded, resultUrl } from '../utils/plan';

const STEPS = 6;

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
    participants: string;              // počet osob - vstupné se počítá za všechny
    max_travel_time_mins: string;
    difficulty: NonNullable<PlanRequest['difficulty']>;
    has_children: boolean;
    wheelchair_accessible: boolean;
    indoor_when_rain: boolean;
}

function initialForm(presetLocation: string | null): WizardForm {
    // Návrat z výsledku přes "Upravit výlet" -> předvyplníme poslední zadání
    try {
        const saved = sessionStorage.getItem('wizardForm');
        if (saved) {
            const form: WizardForm = JSON.parse(saved);
            // Staré zadání (jiný den nebo čas, který už proběhl) -> aktuální časy
            // Datum a čas odjezdu vždy aktuální (minulé plánování by nabídlo starý čas)
            const fresh = { ...form, ...currentTimes() };
            // Výchozí místo se nepamatuje (obec ani poloha) - uživatel ho vždy vybere sám.
            // Výjimka: "Naplánovat výlet odsud" z detailu místa obec předvyplní.
            return { ...fresh, wheelchair_accessible: fresh.wheelchair_accessible ?? false, participants: fresh.participants ?? '1', start: null, location_id: presetLocation ?? '' };
        }
    } catch {
        // poškozená data v session storage ignorujeme
    }
    return {
        location_id: presetLocation ?? '',
        ...currentTimes(),
        transport_mode: 'CAR',
        route_type: 'LOOP',
        interests: [],
        gastro: true,
        food_preferences: [],
        willing_to_pay_entry: true,
        budget_max: '',
        participants: '1',
        max_travel_time_mins: '',
        difficulty: 'MEDIUM',
        has_children: false,
        wheelchair_accessible: false,
        indoor_when_rain: false,
        start: null,
    };
}

function toPlanRequest(f: WizardForm): PlanRequest {
    const interests = f.interests.length > 0 ? [...f.interests] : [...ALL_INTERESTS];
    if (f.gastro) interests.push('GASTRO');
    return {
        ...(f.start
            ? { start_lat: f.start.lat, start_lng: f.start.lng, start_name: f.start.name }
            : { location_id: parseInt(f.location_id) }),
        time_from: `${f.date} ${f.time_from}:00`,
        time_to: `${f.date} ${f.time_to}:00`,
        transport_mode: f.transport_mode,
        route_type: f.route_type,
        interests,
        food_preferences: f.gastro ? f.food_preferences : [],
        willing_to_pay_entry: f.willing_to_pay_entry,
        budget_max: f.budget_max === '' ? null : parseFloat(f.budget_max),
        participants_count: Math.min(Math.max(parseInt(f.participants) || 1, 1), 50),
        max_travel_time_mins: f.max_travel_time_mins === '' ? null : parseInt(f.max_travel_time_mins),
        difficulty: f.difficulty,
        has_children: f.has_children,
        wheelchair_accessible: f.transport_mode === 'WALK' && f.wheelchair_accessible,
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

    // Výchozí místo zadané adresou - kontrola, že leží v Karlovarském kraji (jako u polohy)
    const pickAddress = (a: { name: string; lat: number; lng: number }) => {
        setStepError('');
        const nearest = [...locations].sort((x, y) => distanceKm(a, x) - distanceKm(a, y))[0];
        if (nearest && distanceKm(a, nearest) > 40) {
            return setStepError('Tahle adresa je mimo Karlovarský kraj – KrušnoPlán plánuje výlety po kraji.');
        }
        const short = a.name.split(', ').slice(0, 3).join(', ');
        setFormData(prev => ({ ...prev, start: { lat: a.lat, lng: a.lng, name: short }, location_id: '' }));
    };

    useEffect(() => {
        fetchLocations()
            .then(locs => {
                setLocations(locs);
                // "Naplánovat výlet odsud" z detailu místa: předvyplněná obec se změní na výchozí bod (střed obce)
                setFormData(prev => {
                    const town = !prev.start && prev.location_id ? locs.find(l => String(l.id) === prev.location_id) : undefined;
                    return town ? { ...prev, start: { lat: town.lat, lng: town.lng, name: town.name }, location_id: '' } : prev;
                });
            })
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

    const validateStep = (): string => {
        if (step === 1) {
            if (formData.time_to <= formData.time_from) return 'Čas návratu musí být později než čas odjezdu.';
            // Předvyplněný "teď" je na celé minuty a během vyplňování o chvíli zastará -> do 15 minut ho jen
            // posuneme na aktuální čas (nextStep), chyba až u opravdu proběhlého času
            const start = new Date(`${formData.date}T${formData.time_from}`);
            if (start.getTime() < Date.now() - 15 * 60000) return 'Tento čas už proběhl – vyber pozdější čas nebo jiný den.';
        }
        if (step === 2 && !formData.start) return 'Zadej adresu výchozího místa a vyber ji ze seznamu.';
        return '';
    };

    const nextStep = () => {
        const err = validateStep();
        if (err) return setStepError(err);
        if (step === 1) fixTimes();
        setStep(s => Math.min(s + 1, STEPS));
    };
    const prevStep = () => { setStepError(''); setStep(s => Math.max(s - 1, 1)); };

    const handleSubmit = () => {
        // Mezitím mohl čas odjezdu proběhnout (průvodce byl dlouho otevřený) -> posuneme na teď
        const form = normalizeTimes(formData);
        sessionStorage.setItem('wizardForm', JSON.stringify(form));
        navigate(resultUrl(toPlanRequest(form)));
    };

    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (step === STEPS) handleSubmit();
        else nextStep();
    };

    const locationName = formData.start?.name ?? locations.find(l => String(l.id) === formData.location_id)?.name;

    return (
        <div className="container mx-auto pt-28 pb-12 px-4 max-w-3xl">
            <CarProgress step={step} total={STEPS} />

            <div className="bg-white rounded-3xl shadow-xl shadow-primary/10 p-8 border border-secondary">
                <form onSubmit={onSubmit}>

                    {step === 1 && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-primary-dark">Krok 1 – Čas a datum</h2>
                            <div>
                                <label className="block text-primary-dark mb-2">Datum výletu</label>
                                <input type="date" name="date" min={localDate(new Date())} value={formData.date} onChange={handleChange} className={inputClass} required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-primary-dark mb-2">Čas odjezdu</label>
                                    <input type="time" name="time_from" value={formData.time_from} onChange={handleChange} onBlur={fixTimes}
                                        min={formData.date === localDate(new Date()) ? nowRounded() : undefined} className={inputClass} required />
                                </div>
                                <div>
                                    <label className="block text-primary-dark mb-2">Čas návratu</label>
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
                                <label className="block text-primary-dark mb-2">Výchozí místo</label>
                                {locationsError && <p className="bg-red-100 text-red-700 p-3 rounded-xl mb-3">{locationsError}</p>}
                                {formData.start ? (
                                    <div className="flex items-center justify-between gap-3 p-3 rounded-xl border-2 border-primary bg-secondary">
                                        <span className="flex items-center gap-2 font-semibold text-primary-dark">
                                            <MapPin size={18} aria-hidden="true" /> {formData.start.name}
                                        </span>
                                        <button type="button" onClick={() => setFormData(prev => ({ ...prev, start: null }))}
                                            className="text-gray-500 hover:text-primary-dark" aria-label="Změnit adresu">
                                            <X size={18} />
                                        </button>
                                    </div>
                                ) : (
                                    <AddressSearch onPick={pickAddress} />
                                )}
                            </div>
                            <TransportPicker mode={formData.transport_mode} wheelchair={formData.wheelchair_accessible}
                                onMode={m => { setStepError(''); setFormData(prev => ({ ...prev, transport_mode: m })); }}
                                onWheelchair={on => setFormData(prev => ({ ...prev, wheelchair_accessible: on }))} />
                            <fieldset>
                                <legend className="block text-primary-dark font-semibold mb-3">Typ trasy</legend>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {([
                                        ['LOOP', Repeat, 'Okruh', 'Vrátíme tě zpět do výchozího bodu'],
                                        ['ONE_WAY', ArrowRight, 'Jednosměrně', 'Trasa skončí na poslední zastávce'],
                                    ] as const).map(([value, Icon, title, hint]) => {
                                        const active = formData.route_type === value;
                                        return (
                                            <label key={value} className={`flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition shadow-sm hover:shadow-md hover:border-primary focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${active ? 'border-primary bg-secondary' : 'border-gray-200 bg-white'}`}>
                                                <input type="radio" name="route_type" value={value} checked={active} onChange={handleChange} className="sr-only" />
                                                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition ${active ? 'bg-primary text-white' : 'bg-secondary text-primary'}`}>
                                                    <Icon size={24} aria-hidden="true" />
                                                </span>
                                                <span>
                                                    <span className="block font-semibold text-primary-dark leading-tight">{title}</span>
                                                    <span className="block text-sm text-gray-500 mt-0.5">{hint}</span>
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </fieldset>
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
                            <ChoiceCard type="checkbox" name="gastro" checked={formData.gastro} onChange={handleChange}
                                title="Zahrnout zastávku na jídlo" hint="Restaurace, kavárna nebo pivovar podle preferencí" />
                            {formData.gastro && (
                                <fieldset>
                                    <legend className="block text-primary-dark font-semibold mb-3">Preference <span className="font-normal text-gray-500">(nepovinné)</span></legend>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        {FOOD_PREFERENCES.map(pref => (
                                            <ChoiceCard key={pref.value} type="checkbox" name="food_preferences" value={pref.value}
                                                checked={formData.food_preferences.includes(pref.value)} onChange={handleChange} title={pref.label} />
                                        ))}
                                    </div>
                                    <p className="text-sm text-gray-500 mt-3">Když nic nevybereš, nabídneme jakýkoli podnik v okolí.</p>
                                </fieldset>
                            )}
                        </div>
                    )}

                    {step === 5 && (
                        <div className="space-y-8">
                            <h2 className="text-2xl font-bold text-primary-dark">Krok 5 – Rozpočet a další preference</h2>

                            <fieldset>
                                <legend className="block text-primary-dark font-semibold mb-3">Ochota platit vstupné</legend>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {([['yes', 'Ano, chci vidět vše', 'Plánuji i placená místa'], ['no', 'Ne, pouze zdarma', 'Jen místa bez vstupného']] as const).map(([value, title, hint]) => (
                                        <ChoiceCard key={value} type="radio" name="willing_to_pay_entry" value={value}
                                            checked={formData.willing_to_pay_entry === (value === 'yes')} onChange={handleChange} title={title} hint={hint} />
                                    ))}
                                </div>
                            </fieldset>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <NumberField label="Počet osob" unit="os." name="participants" min="1" max="50" step="1" value={formData.participants} onChange={handleChange} />
                                <NumberField label="Max. útrata celkem" unit="Kč" name="budget_max" min="0" step="50" placeholder="bez omezení" value={formData.budget_max} onChange={handleChange} />
                                <NumberField label="Max. čas na cestě" unit="min" name="max_travel_time_mins" min="0" step="10" placeholder="bez omezení" value={formData.max_travel_time_mins} onChange={handleChange} />
                            </div>

                            <fieldset>
                                <legend className="block text-primary-dark font-semibold mb-3">Náročnost</legend>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {([['EASY', 'Lehká', 'Jen snadno dostupná místa'], ['MEDIUM', 'Střední', 'I rozhledny a lanová centra'], ['HARD', 'Náročná', 'Cokoliv']] as const).map(([value, title, hint]) => (
                                        <ChoiceCard key={value} type="radio" name="difficulty" value={value}
                                            checked={formData.difficulty === value} onChange={handleChange} title={title} hint={hint} />
                                    ))}
                                </div>
                            </fieldset>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <ChoiceCard type="checkbox" name="has_children" checked={formData.has_children} onChange={handleChange}
                                    title="Jedu s dětmi" hint="Jen místa vhodná pro rodiny" />
                                <ChoiceCard type="checkbox" name="indoor_when_rain" checked={formData.indoor_when_rain ?? false} onChange={handleChange}
                                    title="Při dešti jen uvnitř" hint="Jinak plán nezměníme, jen upozorníme na déšť" />
                            </div>
                        </div>
                    )}

                    {step === 6 && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-primary-dark">Krok 6 – Shrnutí</h2>
                            <div className="bg-secondary p-6 rounded-xl space-y-2">
                                <p><strong>Datum:</strong> {new Date(formData.date).toLocaleDateString('cs-CZ')}</p>
                                <p><strong>Čas:</strong> {formData.time_from} – {formData.time_to}</p>
                                <p><strong>Start:</strong> {locationName ?? '–'}</p>
                                <p><strong>Doprava:</strong> {TRANSPORT_LABELS[formData.transport_mode]}{formData.transport_mode === 'WALK' && formData.wheelchair_accessible ? ' (bezbariérově)' : ''}, {formData.route_type === 'LOOP' ? 'okruh' : 'jednosměrně'}</p>
                                <p><strong>Zájmy:</strong> {formData.interests.length ? INTERESTS.filter(i => formData.interests.includes(i.value)).map(i => i.label).join(', ') : 'Překvap mě'}{formData.gastro ? ' + jídlo' : ''}</p>
                                <p><strong>Počet osob:</strong> {formData.participants || 1}</p>
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

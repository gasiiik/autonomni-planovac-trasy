import { useState, useEffect } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Category, Location, PlanRequest } from '../types/api';
import { fetchLocations } from '../services/apiClient';
import { Check, LocateFixed } from 'lucide-react';
import { ALL_INTERESTS, DIFFICULTY_LABELS, FOOD_PREFERENCES, INTERESTS, TRANSPORT_LABELS } from '../constants';
import { CategoryBadge, TransportIcon } from '../components/Icons';
import LocationPicker from '../components/LocationPicker';
import { defaultTimes, localDate, normalizeTimes, nowRounded, resultUrl } from '../utils/plan';

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
            // Výchozí místo se nepamatuje (obec ani poloha) - uživatel ho vždy vybere sám.
            // Výjimka: "Naplánovat výlet odsud" z detailu místa obec předvyplní.
            return { ...fresh, start: null, location_id: presetLocation ?? '' };
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

    const validateStep = (): string => {
        if (step === 1) {
            if (formData.time_to <= formData.time_from) return 'Čas návratu musí být později než čas odjezdu.';
            const start = new Date(`${formData.date}T${formData.time_from}`);
            if (start < new Date()) return 'Tento čas už proběhl – vyber pozdější čas nebo jiný den.';
        }
        if (step === 2 && !formData.location_id && !formData.start) return 'Vyber výchozí obec, nebo použij svou polohu.';
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
                                {locationsError ? (
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
                                {!formData.start && !locationsError && (
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
                                <p><strong>Datum:</strong> {new Date(formData.date).toLocaleDateString('cs-CZ')}</p>
                                <p><strong>Čas:</strong> {formData.time_from} – {formData.time_to}</p>
                                <p><strong>Start:</strong> {locationName ?? '–'}</p>
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

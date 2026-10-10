import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Coffee, Gauge, MapPin, Rocket, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Category, Location, PlanRequest } from '../types/api';
import { fetchLocations } from '../services/apiClient';
import { ALL_INTERESTS, DIFFICULTY_LABELS, FOOD_PREFERENCES, INTERESTS, TRANSPORT_LABELS } from '../constants';
import { CategoryBadge, TransportIcon } from '../components/Icons';
import LocationPicker from '../components/LocationPicker';
import TownMap from '../components/TownMap';
import { addDays, allocateDays } from '../utils/vacation';
import { encodePlan, localDate, normalizeTimes } from '../utils/plan';

const STEPS = 5;
const MAX_DAYS = 14;
const inputClass = 'w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-primary';

// Tempo dovolené = kolik hodin denně jsme na výletech
const PACES: { value: Pace; label: string; hint: string; from: string; to: string; icon: LucideIcon }[] = [
    { value: 'relaxed', label: 'Pohodově', hint: '10:00 – 16:00', from: '10:00', to: '16:00', icon: Coffee },
    { value: 'normal', label: 'Normálně', hint: '9:00 – 18:00', from: '09:00', to: '18:00', icon: Gauge },
    { value: 'full', label: 'Naplno', hint: '8:00 – 20:00', from: '08:00', to: '20:00', icon: Rocket },
];
type Pace = 'relaxed' | 'normal' | 'full';

interface VacationForm {
    arrival: string;
    departure: string;
    pace: Pace;
    towns: string[];                   // obce v pořadí návštěvy
    transport_mode: PlanRequest['transport_mode'];
    interests: Category[];
    gastro: boolean;
    food_preferences: string[];
    willing_to_pay_entry: boolean;
    budget_max: string;                // na den
    participants: string;              // počet osob - vstupné se počítá za všechny
    difficulty: NonNullable<PlanRequest['difficulty']>;
    has_children: boolean;
    indoor_when_rain: boolean;
}

const daysWord = (n: number) => (n === 1 ? 'den' : n < 5 ? 'dny' : 'dní');

function initialForm(): VacationForm {
    const tomorrow = addDays(localDate(new Date()), 1);
    const defaults: VacationForm = {
        arrival: tomorrow, departure: addDays(tomorrow, 3), pace: 'normal', towns: [], transport_mode: 'CAR',
        interests: [], gastro: true, food_preferences: [], willing_to_pay_entry: true, budget_max: '', participants: '1',
        difficulty: 'MEDIUM', has_children: false, indoor_when_rain: false,
    };
    // Návrat z výsledku: předvyplníme preference, ale ne obce a termín v minulosti
    try {
        const saved = sessionStorage.getItem('vacationForm');
        if (saved) {
            const form: VacationForm = { ...defaults, ...JSON.parse(saved), towns: [] };
            return form.arrival < localDate(new Date()) ? { ...form, arrival: defaults.arrival, departure: defaults.departure } : form;
        }
    } catch {
        // poškozená data ignorujeme
    }
    return defaults;
}

function dayCount(f: VacationForm) {
    const diff = Math.round((new Date(`${f.departure}T12:00:00`).getTime() - new Date(`${f.arrival}T12:00:00`).getTime()) / 86400000);
    return diff + 1;
}

function toPlanRequest(f: VacationForm): PlanRequest {
    const pace = PACES.find(p => p.value === f.pace) ?? PACES[1];
    // První den může být dnes - pak začínáme nejdřív "teď"
    const first = normalizeTimes({ date: f.arrival, time_from: pace.from, time_to: pace.to });
    const interests = f.interests.length > 0 ? [...f.interests] : [...ALL_INTERESTS];
    if (f.gastro) interests.push('GASTRO');
    return {
        location_id: Number(f.towns[0]),
        vacation: { towns: f.towns.map(Number), days: dayCount(f), daily_from: `${pace.from}:00` },
        time_from: `${first.date} ${first.time_from}:00`,
        time_to: `${first.date} ${first.time_to}:00`,
        transport_mode: f.transport_mode,
        route_type: 'LOOP',
        interests,
        food_preferences: f.gastro ? f.food_preferences : [],
        willing_to_pay_entry: f.willing_to_pay_entry,
        budget_max: f.budget_max === '' ? null : parseFloat(f.budget_max),
        participants_count: Math.min(Math.max(parseInt(f.participants) || 1, 1), 50),
        difficulty: f.difficulty,
        has_children: f.has_children,
        indoor_when_rain: f.indoor_when_rain,
    };
}

export default function VacationWizard() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [locations, setLocations] = useState<Location[]>([]);
    const [locationsError, setLocationsError] = useState('');
    const [stepError, setStepError] = useState('');
    const [form, setForm] = useState<VacationForm>(initialForm);

    useEffect(() => {
        fetchLocations().then(setLocations).catch(err => setLocationsError(err.message));
    }, []);

    const update = (patch: Partial<VacationForm>) => { setStepError(''); setForm(prev => ({ ...prev, ...patch })); };
    const toggleTown = (id: string) => setForm(prev => ({
        ...prev, towns: prev.towns.includes(id) ? prev.towns.filter(t => t !== id) : [...prev.towns, id],
    }));
    const townName = (id: string) => locations.find(l => String(l.id) === id)?.name ?? '…';
    const days = dayCount(form);

    const validate = (): string => {
        if (step === 1) {
            if (form.arrival < localDate(new Date())) return 'Příjezd nemůže být v minulosti.';
            if (days < 1) return 'Odjezd musí být stejný den nebo později než příjezd.';
            if (days > MAX_DAYS) return `Dovolenou umíme naplánovat nejvýš na ${MAX_DAYS} dní.`;
        }
        if (step === 2) {
            if (form.towns.length === 0) return 'Vyber aspoň jednu obec – na mapě nebo v seznamu.';
            if (form.towns.length > days * 3) return `Na ${days} ${daysWord(days)} je to moc obcí – vyber nejvýš ${days * 3} (3 za den).`;
        }
        return '';
    };

    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
        const err = validate();
        if (err) return setStepError(err);
        if (step < STEPS) return setStep(step + 1);
        sessionStorage.setItem('vacationForm', JSON.stringify(form));
        navigate(`/dovolena/vysledek?plan=${encodePlan(toPlanRequest(form))}`);
    };

    const tile = (active: boolean) => `rounded-2xl border-2 cursor-pointer transition ${active ? 'border-primary bg-secondary' : 'border-gray-200 hover:border-primary'}`;
    const schedule = form.towns.length > 0 && days >= 1 && form.towns.length <= days * 3 ? allocateDays(days, form.towns.map(Number)) : [];

    return (
        <div className="container mx-auto pt-28 pb-12 px-4 max-w-4xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">Plánovač dovolené</p>
            <div className="mb-8 mt-2">
                <p className="text-primary-dark font-medium mb-2">Krok {step} z {STEPS}</p>
                <div className="w-full bg-secondary rounded-full h-2.5">
                    <div className="bg-primary h-2.5 rounded-full transition-all duration-300" style={{ width: `${(step / STEPS) * 100}%` }} />
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-lg p-6 md:p-8 border border-secondary">
                <form onSubmit={onSubmit}>
                    {step === 1 && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-primary-dark">Kdy pojedeš?</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-primary-dark mb-2">Příjezd</label>
                                    <input type="date" min={localDate(new Date())} value={form.arrival} required className={inputClass}
                                        onChange={e => update({ arrival: e.target.value, departure: e.target.value > form.departure ? e.target.value : form.departure })} />
                                </div>
                                <div>
                                    <label className="block text-primary-dark mb-2">Odjezd</label>
                                    <input type="date" min={form.arrival} value={form.departure} required className={inputClass}
                                        onChange={e => update({ departure: e.target.value })} />
                                </div>
                            </div>
                            {days >= 1 && days <= MAX_DAYS && <p className="text-gray-600">Délka dovolené: <strong>{days} {daysWord(days)}</strong></p>}
                            <div>
                                <p className="text-primary-dark mb-2">Tempo – kolik času denně chceš trávit na výletech</p>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {PACES.map(p => (
                                        <button key={p.value} type="button" onClick={() => update({ pace: p.value })} aria-pressed={form.pace === p.value}
                                            className={`${tile(form.pace === p.value)} flex flex-col items-center gap-1 p-4`}>
                                            <p.icon size={28} className="text-primary" aria-hidden="true" />
                                            <span className="font-semibold text-primary-dark">{p.label}</span>
                                            <span className="text-sm text-gray-500">{p.hint}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-5">
                            <h2 className="text-2xl font-bold text-primary-dark">Kam se chceš podívat?</h2>
                            <p className="text-gray-600">Klikni na obce na mapě, nebo je vyhledej. Navštívíme je v pořadí výběru.</p>
                            {locationsError ? <p className="bg-red-100 text-red-700 p-3 rounded-xl">{locationsError}</p> : (
                                <>
                                    <div className="h-80 rounded-2xl overflow-hidden border border-secondary relative z-0">
                                        <TownMap locations={locations} selected={form.towns} onToggle={id => { setStepError(''); toggleTown(id); }} />
                                    </div>
                                    <LocationPicker locations={locations.filter(l => !form.towns.includes(String(l.id)))} value=""
                                        onSelect={id => { setStepError(''); toggleTown(id); }} onClearStart={() => undefined} />
                                </>
                            )}
                            {form.towns.length > 0 && (
                                <ol className="flex flex-wrap gap-2">
                                    {form.towns.map((id, i) => (
                                        <li key={id} className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full bg-secondary text-primary-dark font-semibold">
                                            <span className="text-xs text-primary">{i + 1}.</span> {townName(id)}
                                            <button type="button" aria-label={`Odebrat ${townName(id)}`} onClick={() => toggleTown(id)} className="text-gray-500 hover:text-primary-dark">
                                                <X size={16} />
                                            </button>
                                        </li>
                                    ))}
                                </ol>
                            )}
                            {schedule.length > 0 && (
                                <div className="rounded-xl bg-secondary/60 p-4">
                                    <p className="text-sm font-semibold text-primary-dark flex items-center gap-1.5 mb-1"><MapPin size={15} className="text-primary" aria-hidden="true" /> Rozvrh dovolené</p>
                                    <ol className="text-sm text-gray-700 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5">
                                        {schedule.map((group, d) => (
                                            <li key={d}><span className="text-gray-500">Den {d + 1} · {new Date(addDays(form.arrival, d)).toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' })}:</span> {group.map(id => townName(String(id))).join(' + ')}</li>
                                        ))}
                                    </ol>
                                    <p className="text-xs text-gray-500 mt-2">Víc obcí než dní = výlet přes víc měst za den. Když v obci program dojde, přidáme okolí.</p>
                                </div>
                            )}
                            <div>
                                <p className="text-primary-dark mb-2">Jak se budeš přesouvat?</p>
                                <div className="grid grid-cols-3 gap-3">
                                    {(['CAR', 'BIKE', 'WALK'] as const).map(mode => (
                                        <button key={mode} type="button" onClick={() => update({ transport_mode: mode })} aria-pressed={form.transport_mode === mode}
                                            className={`${tile(form.transport_mode === mode)} flex flex-col items-center gap-1 p-4`}>
                                            <TransportIcon mode={mode} size={30} className="text-primary" />
                                            <span className="font-semibold">{TRANSPORT_LABELS[mode]}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-primary-dark">Co tě baví?</h2>
                            <p className="text-gray-600">Vyber, co tě zajímá, nebo nic nevybírej a necháš se překvapit.</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {INTERESTS.map(interest => {
                                    const active = form.interests.includes(interest.value);
                                    return (
                                        <button key={interest.value} type="button" aria-pressed={active}
                                            onClick={() => update({ interests: active ? form.interests.filter(i => i !== interest.value) : [...form.interests, interest.value] })}
                                            className={`${tile(active)} relative flex flex-col items-center text-center gap-2 p-5`}>
                                            {active && <Check size={20} strokeWidth={3} className="absolute top-3 right-3 text-primary" aria-hidden="true" />}
                                            <CategoryBadge category={interest.value} size={56} />
                                            <span className="font-bold text-primary-dark">{interest.label}</span>
                                            <span className="text-sm text-gray-500">{interest.hint}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            <label className="flex items-center space-x-3 p-4 border rounded-xl hover:bg-secondary cursor-pointer transition">
                                <input type="checkbox" checked={form.gastro} onChange={e => update({ gastro: e.target.checked })} className="text-primary focus:ring-primary h-5 w-5 rounded" />
                                <span>Každý den zastávka na oběd</span>
                            </label>
                            {form.gastro && (
                                <div className="flex flex-wrap gap-3">
                                    {FOOD_PREFERENCES.map(pref => {
                                        const on = form.food_preferences.includes(pref.value);
                                        return (
                                            <label key={pref.value} className="flex items-center space-x-2 px-4 py-2 border rounded-full hover:bg-secondary cursor-pointer transition">
                                                <input type="checkbox" checked={on} className="text-primary focus:ring-primary rounded"
                                                    onChange={() => update({ food_preferences: on ? form.food_preferences.filter(p => p !== pref.value) : [...form.food_preferences, pref.value] })} />
                                                <span>{pref.label}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {step === 4 && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-primary-dark">S kým a za kolik?</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-primary-dark mb-2">Počet osob</label>
                                    <input type="number" min="1" max="50" step="1" value={form.participants} onChange={e => update({ participants: e.target.value })} className={inputClass} />
                                </div>
                                <div>
                                    <label className="block text-primary-dark mb-2">Vstupné</label>
                                    <select value={form.willing_to_pay_entry ? 'yes' : 'no'} onChange={e => update({ willing_to_pay_entry: e.target.value === 'yes' })} className={inputClass}>
                                        <option value="yes">Ano, chci vidět vše</option>
                                        <option value="no">Ne, pouze zdarma</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-primary-dark mb-2">Rozpočet za den, všichni (Kč)</label>
                                    <input type="number" min="0" step="50" placeholder="bez omezení" value={form.budget_max} onChange={e => update({ budget_max: e.target.value })} className={inputClass} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-primary-dark mb-2">Náročnost</label>
                                <select value={form.difficulty} onChange={e => update({ difficulty: e.target.value as VacationForm['difficulty'] })} className={inputClass}>
                                    <option value="EASY">Lehká – jen snadno dostupná místa</option>
                                    <option value="MEDIUM">Střední – i rozhledny a lanová centra</option>
                                    <option value="HARD">Náročná – cokoliv</option>
                                </select>
                            </div>
                            <label className="flex items-center space-x-3 p-4 border rounded-xl hover:bg-secondary cursor-pointer transition">
                                <input type="checkbox" checked={form.has_children} onChange={e => update({ has_children: e.target.checked })} className="text-primary focus:ring-primary h-5 w-5 rounded" />
                                <span>Jedu s dětmi</span>
                            </label>
                            <label className="flex items-center space-x-3 p-4 border rounded-xl hover:bg-secondary cursor-pointer transition">
                                <input type="checkbox" checked={form.indoor_when_rain} onChange={e => update({ indoor_when_rain: e.target.checked })} className="text-primary focus:ring-primary h-5 w-5 rounded" />
                                <span>Když bude pršet, chci jen místa uvnitř <span className="block text-sm text-gray-500">Jinak plán nezměníme, jen tě na déšť upozorníme.</span></span>
                            </label>
                        </div>
                    )}

                    {step === 5 && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-primary-dark">Shrnutí</h2>
                            <div className="bg-secondary p-6 rounded-xl space-y-2">
                                <p><strong>Termín:</strong> {new Date(form.arrival).toLocaleDateString('cs-CZ')} – {new Date(form.departure).toLocaleDateString('cs-CZ')} ({days} {daysWord(days)})</p>
                                <p><strong>Tempo:</strong> {PACES.find(p => p.value === form.pace)?.label} ({PACES.find(p => p.value === form.pace)?.hint})</p>
                                <p><strong>Doprava:</strong> {TRANSPORT_LABELS[form.transport_mode]}</p>
                                <p><strong>Zájmy:</strong> {form.interests.length ? INTERESTS.filter(i => form.interests.includes(i.value)).map(i => i.label).join(', ') : 'Překvap mě'}{form.gastro ? ' + oběd' : ''}</p>
                                <p><strong>Počet osob:</strong> {form.participants || 1}</p>
                                <p><strong>Vstupné:</strong> {form.willing_to_pay_entry ? 'ano' : 'jen zdarma'}{form.budget_max ? `, max. ${form.budget_max} Kč za den` : ''}</p>
                                <p><strong>Náročnost:</strong> {DIFFICULTY_LABELS[form.difficulty]}{form.has_children ? ', s dětmi' : ''}</p>
                            </div>
                            <div>
                                <p className="font-semibold text-primary-dark mb-2">Rozvrh</p>
                                <ol className="space-y-1 text-gray-700">
                                    {schedule.map((group, d) => (
                                        <li key={d}><span className="text-gray-500">Den {d + 1}:</span> {group.map(id => townName(String(id))).join(' + ')}</li>
                                    ))}
                                </ol>
                                <p className="text-sm text-gray-500 mt-2">U každé obce, kde budeš bydlet, ti nabídneme ubytování.</p>
                            </div>
                        </div>
                    )}

                    {stepError && <p className="mt-6 bg-red-100 text-red-700 p-3 rounded-xl">{stepError}</p>}

                    <div className="mt-8 flex justify-between">
                        {step > 1 ? (
                            <button type="button" onClick={() => { setStepError(''); setStep(step - 1); }} className="px-6 py-3 border border-primary text-primary font-bold rounded-full hover:bg-primary hover:text-white transition">
                                Zpět
                            </button>
                        ) : <div />}
                        <button type="submit" className="px-8 py-3 bg-accent text-primary-dark font-bold rounded-full hover:bg-yellow-400 transition shadow-md">
                            {step === STEPS ? 'Naplánovat dovolenou' : 'Pokračovat'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

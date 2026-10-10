import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import type { DatasetsResponse, Place } from '../types/api';
import { fetchDatasets, fetchLocations, fetchPlaces } from '../services/apiClient';
import { CATEGORY_LABELS, THEMES, TRANSPORT_LABELS } from '../constants';
import { CategoryTag } from '../components/Icons';
import type { Theme } from '../constants';
import { defaultTimes, resultUrl } from '../utils/plan';
import {
    ArrowRight, Building2, CalendarCheck, CalendarClock, CalendarRange, CloudSun, Coins, Database, DoorOpen, Layers,
    Luggage, Repeat, ShieldCheck, Sun, Ticket, Umbrella, Users, UtensilsCrossed,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import DataCounter from '../components/DataCounter';
import PlaceImage from '../components/PlaceImage';

const bgImages = [
    '/images/main/1.png',
    '/images/main/2.png',
    '/images/main/3.png'
];

// Co plánovač skutečně hlídá (funkce backendu)
const FEATURES: [LucideIcon, string][] = [
    [CalendarClock, 'Otevírací dobu – když je zavřeno, počkáme'],
    [Sun, 'Sezónu koupališť, lanových center a rozhleden'],
    [CloudSun, 'Hodinovou předpověď počasí u každé zastávky'],
    [UtensilsCrossed, 'Oběd mezi 11:30 a 14:00'],
    [Coins, 'Rozpočet a vstupné'],
    [Repeat, 'Čas na návrat zpět do startu'],
];

// Pro koho je aplikace: problém -> přínos (osnova hodnocení hackathonu)
const AUDIENCES: { icon: LucideIcon; who: string; problem: string; benefit: string }[] = [
    {
        icon: Luggage, who: 'Turisté a návštěvníci kraje',
        problem: 'Neznají kraj a plánování výletu je stojí hodinu na desítkách webů – co je kde, kdy má otevřeno, kolik stojí.',
        benefit: 'Zadají, kolik mají času a co je baví, a dostanou hotový harmonogram s mapou, navigací a ubytováním.',
    },
    {
        icon: Users, who: 'Místní a rodiny s dětmi',
        problem: 'Chtějí na víkend vyrazit jinam než na známá místa, ale nevědí kam – a co dělat, když prší.',
        benefit: 'Objeví i méně známá místa v okolí, plán se přizpůsobí dětem, rozpočtu i počasí.',
    },
    {
        icon: Building2, who: 'Kraj, obce a infocentra',
        problem: 'Turisté se tlačí na pár nejznámějších místech, menší památky a obce zůstávají stranou.',
        benefit: 'Plánovač nabízí i méně známá místa a rozkládá návštěvnost po kraji. Infocentra ho mohou nabízet návštěvníkům.',
    },
];

// Co z otevřených dat DataZápadu odvozujeme (data nejen zobrazujeme)
const DERIVED: [LucideIcon, string][] = [
    [ShieldCheck, 'přístupnost – nepřístupné objekty vynecháme'],
    [DoorOpen, 'otevírací dobu z textových poznámek'],
    [CalendarCheck, 'sezónu – koupaliště, lanová centra, lyžování'],
    [Ticket, 'vstupné – zdarma, nebo placené'],
    [Umbrella, 'místa uvnitř pro deštivé dny'],
    [Layers, 'jedno místo ve více sadách sloučíme'],
];

const STEPS: [string, string][] = [
    ['Řekni, kdy a jak', 'Jeden den, nebo celá dovolená? Datum, kolik máš času, odkud vyrážíš a jestli pojedeš autem, na kole, nebo půjdeš pěšky.'],
    ['Vyber, co tě baví', 'Památky, příroda, zábava pro děti, jídlo – a k tomu rozpočet nebo náročnost.'],
    ['Dostaneš hotový plán', 'Časový harmonogram, mapa trasy, počasí a navigace do Google Maps, Mapy.cz nebo Apple Map. Plán můžeš sdílet nebo uložit do kalendáře.'],
];

// Náhodný výběr míst s fotkou pro "Věděli jste?"
function pickRandom(places: Place[], count: number) {
    const withPhoto = places.filter(p => p.image_url && p.category !== 'GASTRO');
    return [...withPhoto].sort(() => Math.random() - 0.5).slice(0, count);
}

export default function Home() {
    const navigate = useNavigate();
    const [currentBg, setCurrentBg] = useState(0);
    const [stats, setStats] = useState<DatasetsResponse | null>(null);
    const [places, setPlaces] = useState<Place[]>([]);
    const [highlights, setHighlights] = useState<Place[]>([]);
    const [themeError, setThemeError] = useState('');
    const [themeLoading, setThemeLoading] = useState<string | null>(null);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentBg((prev) => (prev + 1) % bgImages.length);
        }, 10000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        // Úvodní stránka funguje i bez backendu - počítadlo a tipy se jen nezobrazí
        fetchDatasets().then(setStats).catch(() => setStats(null));
        fetchPlaces().then(p => { setPlaces(p); setHighlights(pickRandom(p, 4)); }).catch(() => setPlaces([]));
    }, []);

    const startTheme = async (theme: Theme) => {
        setThemeError('');
        setThemeLoading(theme.title);
        try {
            const locations = await fetchLocations();
            const loc = locations.find(l => l.name === theme.start);
            if (!loc) throw new Error(`Výchozí místo ${theme.start} nebylo nalezeno.`);
            const t = defaultTimes();
            navigate(resultUrl({
                ...theme.request,
                location_id: loc.id,
                time_from: `${t.date} ${t.time_from}:00`,
                time_to: `${t.date} ${t.time_to}:00`,
            }));
        } catch (err) {
            setThemeError(err instanceof Error ? err.message : String(err));
            setThemeLoading(null);
        }
    };

    return (
        <div>
            {/* Hero Section */}
            <section className="relative min-h-[90vh] flex items-center justify-center bg-primary-dark text-white text-center px-4 overflow-hidden">
                {/* Background Images Slider */}
                {bgImages.map((src, index) => (
                    <div
                        key={src}
                        className={`absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000 ease-in-out ${index === currentBg ? 'opacity-100' : 'opacity-0'}`}
                        style={{ backgroundImage: `url(${src})` }}
                    />
                ))}

                {/* Darken Overlay */}
                <div className="absolute inset-0 bg-primary-dark opacity-60 mix-blend-multiply" />

                <div className="relative z-20 max-w-4xl mx-auto px-4 md:px-8 pt-32 pb-36 md:pb-48">
                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold mb-6 drop-shadow-lg leading-tight">
                        Objev svůj další <span className="text-accent">nezapomenutelný</span> zážitek.
                    </h1>
                    <p className="text-lg md:text-xl lg:text-2xl mb-10 text-white/95 drop-shadow-md font-medium leading-relaxed max-w-3xl mx-auto">
                        Vyber si, co chceš zažít a jaké máš možnosti. Náš algoritmus za tebe naplánuje celou trasu po Karlovarském kraji, ideální zastávky i časový harmonogram na míru.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                        <Link to="/wizard" className="group flex flex-col items-center gap-1 bg-accent text-primary-dark px-8 py-5 rounded-3xl font-bold hover:bg-yellow-400 transition shadow-xl transform hover:-translate-y-1">
                            <span className="flex items-center gap-2 text-xl"><Sun size={24} aria-hidden="true" /> Výlet na den</span>
                            <span className="text-sm font-medium opacity-80">harmonogram na jeden den</span>
                        </Link>
                        <Link to="/dovolena" className="group flex flex-col items-center gap-1 bg-white text-primary-dark px-8 py-5 rounded-3xl font-bold hover:bg-secondary transition shadow-xl transform hover:-translate-y-1">
                            <span className="flex items-center gap-2 text-xl"><CalendarRange size={24} aria-hidden="true" /> Dovolená</span>
                            <span className="text-sm font-medium opacity-80">víc dní, víc měst a ubytování</span>
                        </Link>
                    </div>
                    <Link to="/mapa" className="inline-block mt-6 text-white/90 font-semibold underline hover:text-accent">Nebo si prohlédni mapu všech míst</Link>
                </div>

                {/* Organický tvar (vlna) naspodu */}
                <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none z-10">
                    <svg className="relative block w-full h-[60px] md:h-[120px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320" preserveAspectRatio="none">
                        <path fill="#ffffff" d="M0,96L80,112C160,128,320,160,480,170.7C640,181,800,171,960,149.3C1120,128,1280,96,1360,80L1440,64L1440,320L1360,320C1280,320,1120,320,960,320C800,320,640,320,480,320C320,320,160,320,80,320L0,320Z"></path>
                    </svg>
                </div>
            </section>

            {/* Počítadlo dat z DataZápadu */}
            <DataCounter stats={stats} places={places} />

            {/* Tematické výlety */}
            <section className="py-16 md:py-20 px-4 bg-white">
                <div className="container mx-auto max-w-6xl">
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2 mb-8">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-widest text-primary">Inspirace</p>
                            <h2 className="text-3xl md:text-4xl font-bold text-primary-dark mt-1">Hotové výlety</h2>
                        </div>
                        <p className="text-gray-600 md:max-w-sm md:text-right">Vyber trasu a plán na dnešek dostaneš hned. Upravit ho můžeš kdykoli v průvodci.</p>
                    </div>
                    {themeError && <p className="bg-red-100 text-red-700 p-3 rounded-xl mb-6">{themeError}</p>}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {THEMES.map(theme => {
                            const photo = places.find(p => p.name === theme.photoPlace);
                            return (
                                <button key={theme.title} onClick={() => startTheme(theme)} disabled={themeLoading !== null}
                                    className="group relative h-96 rounded-2xl overflow-hidden text-left shadow-md hover:shadow-2xl transition disabled:opacity-70 focus:outline-none focus-visible:ring-4 focus-visible:ring-accent">
                                    <PlaceImage src={photo?.image_url} alt={theme.photoPlace} category={photo?.category ?? 'SIGHTSEEING'}
                                        credit="top" className="absolute inset-0 w-full h-full"
                                        imgClassName="transition-transform duration-700 group-hover:scale-105" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
                                    <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                                        <p className="text-xs font-semibold uppercase tracking-wider text-white/75">
                                            {theme.start} · {TRANSPORT_LABELS[theme.request.transport_mode].toLowerCase()}
                                        </p>
                                        <h3 className="text-2xl font-bold leading-tight mt-1">{theme.title}</h3>
                                        <p className="text-sm text-white/85 mt-2 leading-relaxed">{theme.description}</p>
                                        <span className="mt-4 inline-flex items-center gap-2 font-semibold text-accent">
                                            {themeLoading === theme.title ? 'Plánuji…' : 'Naplánovat'}
                                            <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                                <path fillRule="evenodd" d="M3 10a1 1 0 011-1h9.586l-3.293-3.293a1 1 0 111.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 11-1.414-1.414L13.586 11H4a1 1 0 01-1-1z" clipRule="evenodd" />
                                            </svg>
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Věděli jste? - místa z dat */}
            {highlights.length > 0 && (
                <section className="py-16 md:py-20 px-4 bg-secondary">
                    <div className="container mx-auto max-w-6xl">
                        <h2 className="text-3xl md:text-4xl font-bold text-primary-dark mb-3 text-center">Věděli jste, že v kraji najdete…</h2>
                        <p className="text-center text-gray-600 mb-10 text-lg">Pár náhodných míst z otevřených dat. Při každé návštěvě jiná.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {highlights.map(p => (
                                <Link key={p.id} to={`/misto/${p.id}`} className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition transform hover:-translate-y-1">
                                    <PlaceImage src={p.image_url} alt={p.name} category={p.category} className="w-full h-44" />
                                    <div className="p-5">
                                        <p className="text-sm text-gray-500"><CategoryTag category={p.category} label={CATEGORY_LABELS[p.category]} /></p>
                                        <h3 className="font-bold text-primary-dark text-lg leading-snug mt-1">{p.name}</h3>
                                    </div>
                                </Link>
                            ))}
                        </div>
                        <div className="text-center mt-10">
                            <Link to="/mapa" className="inline-block px-8 py-4 border-2 border-primary text-primary font-bold rounded-full hover:bg-primary hover:text-white transition">
                                Všechna místa na mapě
                            </Link>
                        </div>
                    </div>
                </section>
            )}

            {/* Pro koho - problém a přínos */}
            <section className="py-16 md:py-24 px-4 bg-white">
                <div className="container mx-auto max-w-6xl">
                    <p className="text-sm font-semibold uppercase tracking-widest text-primary">Proč KrušnoPlán</p>
                    <h2 className="text-3xl md:text-4xl font-bold text-primary-dark mt-1 mb-4 max-w-3xl leading-tight">
                        Naplánovat výlet po kraji nemá zabrat víc času než výlet samotný
                    </h2>
                    <p className="text-lg text-gray-700 max-w-3xl mb-10 leading-relaxed">
                        Informace o hradech, muzeích, pramenech a rozhlednách jsou roztroušené po desítkách webů. Kraj je ale má
                        pohromadě v otevřených datech – KrušnoPlán z nich za pár vteřin sestaví plán na míru.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {AUDIENCES.map(a => (
                            <div key={a.who} className="rounded-3xl border border-secondary bg-secondary/40 p-6 flex flex-col">
                                <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary text-accent mb-4">
                                    <a.icon size={24} aria-hidden="true" />
                                </span>
                                <h3 className="text-xl font-bold text-primary-dark mb-3">{a.who}</h3>
                                <p className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-1">Problém</p>
                                <p className="text-gray-700 mb-4">{a.problem}</p>
                                <p className="text-sm font-semibold uppercase tracking-wide text-primary mb-1">Přínos</p>
                                <p className="text-gray-800">{a.benefit}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Jak to funguje */}
            <section id="jak-to-funguje" className="py-16 md:py-24 px-4 bg-white scroll-mt-24">
                <div className="container mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-widest text-primary">Jak to funguje</p>
                        <h2 className="text-3xl md:text-4xl font-bold text-primary-dark mt-1 mb-5 leading-tight">
                            Celý den naplánovaný za pár vteřin
                        </h2>
                        <p className="text-lg text-gray-700 leading-relaxed mb-8">
                            Nemusíš procházet desítky webů a hlídat, co má kdy otevřeno. KrušnoPlán vezme místa z otevřených dat
                            Karlovarského kraje a poskládá z nich trasu, která se ti vejde do dne.
                        </p>
                        <p className="font-semibold text-primary-dark mb-3">Na co myslíme za tebe</p>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 mb-10">
                            {FEATURES.map(([Icon, text]) => (
                                <li key={text} className="flex items-start gap-3 text-gray-700">
                                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary text-primary shrink-0">
                                        <Icon size={18} strokeWidth={2.25} aria-hidden="true" />
                                    </span>
                                    <span className="pt-1">{text}</span>
                                </li>
                            ))}
                        </ul>
                        <Link to="/wizard" className="inline-flex items-center gap-2 bg-accent text-primary-dark px-8 py-4 rounded-full font-bold hover:bg-yellow-400 transition shadow-md">
                            Naplánovat výlet <ArrowRight size={20} aria-hidden="true" />
                        </Link>
                    </div>

                    <ol className="relative">
                        {STEPS.map(([title, text], i) => (
                            <li key={title} className="relative pl-14 pb-8 last:pb-0">
                                {/* Čárkovaná spojnice ke dalšímu kroku (jako trasa na mapě) */}
                                {i < STEPS.length - 1 && <span className="absolute left-[19px] top-[60px] -bottom-5 border-l-2 border-dashed border-primary/50" aria-hidden="true" />}
                                {/* Číslo kroku zarovnané s nadpisem karty; poslední (výsledek) plné */}
                                <span className={`absolute left-0 top-5 flex items-center justify-center w-10 h-10 rounded-full border-2 border-primary font-bold ${i === STEPS.length - 1 ? 'bg-primary text-white' : 'bg-white text-primary'}`}>
                                    {i + 1}
                                </span>
                                <div className="bg-secondary/60 rounded-2xl p-6">
                                    <h3 className="text-xl font-bold text-primary-dark mb-2">{title}</h3>
                                    <p className="text-gray-700 leading-relaxed">{text}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>

                {/* Postaveno na otevřených datech - čísla živě z databáze */}
                <div className="container mx-auto max-w-6xl mt-14 rounded-3xl bg-primary-dark text-white p-6 md:p-10">
                    <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
                        <div className="lg:w-2/5">
                            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-accent">
                                <Database size={16} aria-hidden="true" /> Otevřená data
                            </p>
                            <h3 className="text-2xl md:text-3xl font-bold mt-2 mb-4 leading-tight">Postaveno na datech Karlovarského kraje</h3>
                            {stats && (
                                <div className="flex gap-8 mb-4">
                                    <div><p className="text-4xl font-extrabold text-accent">{stats.places_from_datazapad}</p><p className="text-white/80 text-sm">míst z DataZápadu</p></div>
                                    <div><p className="text-4xl font-extrabold text-accent">{stats.datasets.length}</p><p className="text-white/80 text-sm">datových sad</p></div>
                                </div>
                            )}
                            <p className="text-white/80 text-sm leading-relaxed">
                                Jádrem plánovače jsou otevřená data z{' '}
                                <a href="https://www.datazapad.cz/" target="_blank" rel="noopener noreferrer" className="underline hover:text-accent">DataZápadu</a>
                                {' '}– hrady, zámky, muzea, prameny, rozhledny, příroda i zábava. Doplňují je předpověď počasí (Open-Meteo),
                                fotky (Wikimedia), ubytování a mapy (OpenStreetMap) a odkazy do kalendáře akcí kraje.
                            </p>
                        </div>
                        <div className="lg:w-3/5">
                            <p className="font-semibold mb-4">Data nejen zobrazujeme – vyčteme z nich, co plánovač potřebuje:</p>
                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {DERIVED.map(([Icon, text]) => (
                                    <li key={text} className="flex items-start gap-3 bg-white/10 rounded-xl p-3">
                                        <Icon size={20} className="text-accent shrink-0 mt-0.5" aria-hidden="true" />
                                        <span className="text-white/90">{text}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}

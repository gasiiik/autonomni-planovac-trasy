import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import type { DatasetsResponse, Place } from '../types/api';
import { fetchDatasets, fetchLocations, fetchPlaces } from '../services/apiClient';
import { CATEGORY_ICONS, CATEGORY_LABELS, THEMES } from '../constants';
import type { Theme } from '../constants';
import { defaultTimes, resultUrl } from '../utils/plan';
import DataCounter from '../components/DataCounter';
import PlaceImage from '../components/PlaceImage';

const bgImages = [
    '/images/main/1.png',
    '/images/main/2.png',
    '/images/main/3.png'
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
            <section className="relative h-[90vh] flex items-center justify-center bg-primary-dark text-white text-center px-4 overflow-hidden">
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

                <div className="relative z-20 max-w-4xl mx-auto px-4 md:px-8 pt-32 pb-12">
                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold mb-6 drop-shadow-lg leading-tight">
                        Objev svůj další <span className="text-accent">nezapomenutelný</span> zážitek.
                    </h1>
                    <p className="text-lg md:text-xl lg:text-2xl mb-10 text-white/95 drop-shadow-md font-medium leading-relaxed max-w-3xl mx-auto">
                        Vyber si, co chceš zažít a jaké máš možnosti. Náš algoritmus za tebe naplánuje celou trasu po Karlovarském kraji, ideální zastávky i časový harmonogram na míru.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-6">
                        <Link to="/wizard" className="bg-accent text-primary-dark px-10 py-5 rounded-full font-bold text-xl hover:bg-yellow-400 transition shadow-xl transform hover:-translate-y-1">
                            Začít plánovat výlet
                        </Link>
                        <Link to="/mapa" className="bg-white/15 backdrop-blur border border-white/40 text-white px-8 py-5 rounded-full font-bold text-xl hover:bg-white/25 transition">
                            Prohlédnout mapu míst
                        </Link>
                    </div>
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
                    <h2 className="text-3xl md:text-4xl font-bold text-primary-dark mb-3 text-center">Výlet na jedno kliknutí</h2>
                    <p className="text-center text-gray-600 mb-10 text-lg">Nevíš, kam vyrazit? Vyber si téma a plán dostaneš hned.</p>
                    {themeError && <p className="bg-red-100 text-red-700 p-3 rounded-xl mb-6 text-center">{themeError}</p>}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {THEMES.map(theme => (
                            <button key={theme.title} onClick={() => startTheme(theme)} disabled={themeLoading !== null}
                                className="text-left bg-secondary hover:bg-primary hover:text-white group p-6 rounded-3xl shadow-sm hover:shadow-xl transition transform hover:-translate-y-1 disabled:opacity-60">
                                <span className="text-4xl">{theme.icon}</span>
                                <h3 className="text-xl font-bold mt-3 mb-2 text-primary-dark group-hover:text-white">{theme.title}</h3>
                                <p className="text-gray-600 group-hover:text-white/90">{theme.description}</p>
                                <p className="mt-4 font-semibold text-primary group-hover:text-accent">
                                    {themeLoading === theme.title ? 'Plánuji…' : 'Naplánovat →'}
                                </p>
                            </button>
                        ))}
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
                                        <p className="text-sm text-gray-500">{CATEGORY_ICONS[p.category]} {CATEGORY_LABELS[p.category]}</p>
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

            {/* O aplikaci */}
            <section className="py-16 md:py-24 px-4 bg-white">
                <div className="container mx-auto max-w-5xl text-center">
                    <h2 className="text-3xl md:text-4xl font-bold text-primary-dark mb-6">Proč plánovat s KrušnoPlánem?</h2>
                    <p className="text-lg md:text-xl text-gray-700 leading-relaxed mb-12">
                        Jsme průvodce pro každého, kdo chce cestovat bez starostí s dlouhým hledáním. Stačí nám říct, zda máte rádi hrady, přírodu, gastronomii, nebo spíše aktivní odpočinek. KrušnoPlán vypočítá nejlepší možnou trasu a vezme v úvahu, kdy vyrazíte i jak dlouho chcete na místě zůstat.
                    </p>
                </div>
            </section>

            {/* Další sekce - Jak to funguje */}
            <section id="jak-to-funguje" className="py-16 md:py-24 px-4 bg-secondary">
                <div className="container mx-auto">
                    <h2 className="text-3xl md:text-4xl font-bold text-primary-dark mb-12 text-center md:mb-16">Jak to funguje</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
                        <div className="bg-white p-8 md:p-10 rounded-3xl text-center shadow-lg">
                            <h3 className="text-2xl font-bold mb-4 text-primary-dark">Zadej preference</h3>
                            <p className="text-gray-600 text-lg">Zvolíš si datum, časové okno, způsob dopravy (auto/kolo/pěšky) a kategorie, které tě zajímají. Třeba památky, výhledy nebo adrenalin.</p>
                        </div>
                        <div className="bg-white p-8 md:p-10 rounded-3xl text-center shadow-lg">
                            <h3 className="text-2xl font-bold mb-4 text-primary-dark">Chytrý algoritmus</h3>
                            <p className="text-gray-600 text-lg">Plánovač projde stovky míst z otevřených dat Karlovarského kraje a sestaví itinerář, kde přesně víš, kolik času strávíš cestou a na místech.</p>
                        </div>
                        <div className="bg-white p-8 md:p-10 rounded-3xl text-center shadow-lg">
                            <h3 className="text-2xl font-bold mb-4 text-primary-dark">Vyraz za zážitky</h3>
                            <p className="text-gray-600 text-lg">Užij si bezstarostný výlet podle plánu. Přizpůsobili jsme vše tvým možnostem, stačí jen následovat harmonogram.</p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}

import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useFavorites } from '../utils/favorites';

// Stránky s vrstevnicemi na pozadí (průvodci a oblíbené)
const TOPO_PAGES = ['/wizard', '/dovolena', '/oblibene'];

export default function Layout() {
    const [isVisible, setIsVisible] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);
    const { pathname } = useLocation();
    const favorites = useFavorites();
    const navigate = useNavigate();

    // Otazník vždy posune na sekci "Jak to funguje" - i opakovaně a z jiné stránky
    const showHowItWorks = (e: React.MouseEvent) => {
        e.preventDefault();
        const scroll = (tries = 0) => {
            const el = document.getElementById('jak-to-funguje');
            // Obsah sekce (nadpis a karty kroků) zarovnáme kousek pod horní okraj okna
            const content = el?.firstElementChild;
            if (content) window.scrollTo({ top: content.getBoundingClientRect().top + window.scrollY - 56, behavior: 'smooth' });
            else if (tries < 40) setTimeout(() => scroll(tries + 1), 50);   // úvodní stránka se ještě vykresluje
        };
        if (pathname !== '/') {
            navigate('/');
            setTimeout(() => scroll(40), 800);   // dorovnání, kdyby se nad sekcí ještě donačetly fotky
        }
        scroll();
    };

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            if (currentScrollY > lastScrollY && currentScrollY > 50) {
                setIsVisible(false);
            } else {
                setIsVisible(true);
            }
            setLastScrollY(currentScrollY);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [lastScrollY]);

    return (
        <div className="min-h-screen flex flex-col">
            <header className={`print:hidden fixed top-6 left-0 w-full z-50 px-4 transition-transform duration-300 ${isVisible ? 'translate-y-0' : '-translate-y-[150%]'}`}>
                <div className="container mx-auto flex justify-center">
                    <div className="bg-primary/80 backdrop-blur-md border border-white/20 shadow-lg rounded-full px-6 py-2 flex items-center justify-between w-full max-w-4xl">
                        <Link to="/" className="flex items-center gap-2 font-bold tracking-wide text-xl text-white hover:text-accent transition-colors shrink-0">
                            <img src="/images/logo.png" alt="" className="h-8 w-auto rounded-md" />
                            KrušnoPlán
                        </Link>
                        
                        <nav className="flex items-center gap-3 lg:gap-6 font-medium text-sm text-white">
                            <Link to="/" className="hover:text-accent transition-colors hidden lg:block">Domů</Link>
                            <Link to="/mapa" className="hover:text-accent transition-colors hidden md:block">Mapa míst</Link>
                            <Link to="/akce" className="hover:text-accent transition-colors hidden lg:block">Kalendář akcí</Link>
                            <Link to="/oblibene" className="relative hover:text-accent transition-colors" title="Oblíbená místa" aria-label={`Oblíbená místa (${favorites.length})`}>
                                <Heart size={22} fill={favorites.length ? 'currentColor' : 'none'} aria-hidden="true" />
                                {favorites.length > 0 && (
                                    <span className="absolute -top-2 -right-2.5 min-w-5 h-5 px-1 rounded-full bg-accent text-primary-dark text-xs font-bold flex items-center justify-center">{favorites.length}</span>
                                )}
                            </Link>
                            <Link to="/dovolena" className="border-2 border-accent text-accent hover:bg-accent hover:text-primary-dark transition-colors px-4 py-1.5 rounded-full font-bold whitespace-nowrap hidden sm:block">
                                Naplánovat dovolenou
                            </Link>
                            <Link to="/wizard" className="bg-accent text-primary-dark hover:bg-yellow-400 transition-colors px-4 lg:px-5 py-2 rounded-full font-bold shadow-sm whitespace-nowrap">
                                Naplánovat výlet
                            </Link>
                        </nav>
                    </div>
                </div>
            </header>

            {/* Plovoucí otazník vlevo nahoře */}
            <a href="/#jak-to-funguje" onClick={showHowItWorks} className="print:hidden fixed top-6 left-4 md:left-6 z-50 bg-primary text-white w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shadow-lg hover:bg-primary-dark hover:scale-110 transition-all font-bold text-xl" title="Jak to funguje">
                ?
            </a>

            <main className={`flex-grow ${TOPO_PAGES.includes(pathname) ? 'topo-bg' : 'bg-[#FFFFFF]'}`}>
                <Outlet />
            </main>
            <footer className="print:hidden bg-primary-dark text-white p-6 text-center space-y-2">
                <p className="text-sm text-white/90">
                    Turistické cíle pocházejí z otevřených dat Karlovarského kraje –{' '}
                    <a href="https://www.datazapad.cz/" target="_blank" rel="noopener noreferrer" className="underline hover:text-accent">DataZápad</a>
                    {' '}(licence CC BY 4.0 a CC0).
                </p>
                <p className="text-xs text-white/70">
                    Počasí: Open-Meteo · Fotky: Wikipedie a Wikimedia Commons · Mapa: © přispěvatelé OpenStreetMap
                </p>
                <p className="text-xs text-white/70">
                    &copy; {new Date().getFullYear()} KrušnoPlán · Prototyp z Hackathonu otevřených dat Karlovarského kraje 2026. Není oficiální službou Karlovarského kraje ani KIC KK.
                </p>
            </footer>
        </div>
    )
}

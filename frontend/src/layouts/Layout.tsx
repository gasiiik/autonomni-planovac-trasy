import { useState, useEffect } from 'react';
import { Outlet, Link } from 'react-router-dom';

export default function Layout() {
    const [isVisible, setIsVisible] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);

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
                    <div className="bg-primary/80 backdrop-blur-md border border-white/20 shadow-lg rounded-full px-6 py-2 flex items-center justify-between w-full max-w-2xl">
                        <Link to="/" className="flex items-center gap-2 font-bold tracking-wide text-xl text-white hover:text-accent transition-colors shrink-0">
                            <img src="/images/logo.png" alt="" className="h-8 w-auto rounded-md" />
                            KrušnoPlán
                        </Link>
                        
                        <nav className="flex items-center gap-6 font-medium text-sm text-white">
                            <Link to="/" className="hover:text-accent transition-colors hidden sm:block">Domů</Link>
                            <Link to="/mapa" className="hover:text-accent transition-colors hidden sm:block">Mapa míst</Link>
                            <Link to="/o-datech" className="hover:text-accent transition-colors hidden md:block">O datech</Link>
                            <Link to="/wizard" className="bg-accent text-primary-dark hover:bg-yellow-400 transition-colors px-5 py-2 rounded-full font-bold shadow-sm whitespace-nowrap">
                                Naplánovat výlet
                            </Link>
                        </nav>
                    </div>
                </div>
            </header>

            {/* Plovoucí otazník vlevo nahoře */}
            <a href="/#jak-to-funguje" className="print:hidden fixed top-6 left-4 md:left-6 z-50 bg-primary text-white w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shadow-lg hover:bg-primary-dark hover:scale-110 transition-all font-bold text-xl" title="Jak to funguje">
                ?
            </a>

            <main className="flex-grow bg-[#FFFFFF]">
                <Outlet />
            </main>
            <footer className="print:hidden bg-primary-dark text-white p-6 text-center space-y-2">
                <p className="text-sm text-white/90">
                    Turistické cíle pochází z otevřených dat Karlovarského kraje –{' '}
                    <a href="https://www.datazapad.cz/" target="_blank" rel="noopener noreferrer" className="underline hover:text-accent">DataZápad</a>
                    {' '}(licence CC BY 4.0 a CC0).{' '}
                    <Link to="/o-datech" className="underline hover:text-accent">Přehled použitých dat</Link>
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

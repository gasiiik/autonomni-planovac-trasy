import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';

const bgImages = [
    '/images/main/1.png',
    '/images/main/2.png',
    '/images/main/3.png'
];

export default function Home() {
    const [currentBg, setCurrentBg] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentBg((prev) => (prev + 1) % bgImages.length);
        }, 10000);
        return () => clearInterval(interval);
    }, []);

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
                        Vyber si, co chceš zažít a jaké máš možnosti. Náš inteligentní algoritmus za tebe naplánuje celou trasu, ideální zastávky i časový harmonogram na míru.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-6">
                        <Link to="/wizard" className="bg-accent text-primary-dark px-10 py-5 rounded-full font-bold text-xl hover:bg-yellow-400 transition shadow-xl transform hover:-translate-y-1">
                            Začít plánovat výlet
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

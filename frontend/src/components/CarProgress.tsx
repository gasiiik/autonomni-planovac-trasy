// Ukazatel kroků: autíčko jede po silnici a plynule se posouvá na další krok, na místě se jemně zhoupne
export default function CarProgress({ step, total }: { step: number; total: number }) {
    const pct = (step - 1) / (total - 1) * 100;   // poloha autíčka na ose (krok 1 = začátek, poslední krok = cíl)
    return (
        <div className="mb-8" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step} aria-label={`Krok ${step} z ${total}`}>
            <style>{`
                @keyframes car-bounce { 0% { transform: translateY(0) rotate(0); } 35% { transform: translateY(-3px) rotate(-3deg); } 70% { transform: translateY(0) rotate(1.5deg); } 100% { transform: translateY(0) rotate(0); } }
                .car-bounce { animation: car-bounce .6s ease-out 1.4s 1; }
                @keyframes car-smoke-wrap { 0%, 85% { opacity: 1; } 100% { opacity: 0; } }
                @keyframes car-smoke { 0% { transform: translate(0, 0) scale(.4); opacity: 0; } 15% { opacity: .55; } 100% { transform: translate(-34px, -14px) scale(1.6); opacity: 0; } }
                .car-smoke { animation: car-smoke 1s ease-out infinite both; }
                @media (prefers-reduced-motion: reduce) { .car-track, .car-bounce, .car-smoke { transition: none !important; animation: none !important; } }
            `}</style>
            <p className="text-primary-dark font-medium mb-1">Krok {step} z {total}</p>
            {/* Vodorovné odsazení = polovina autíčka, aby na krajích nepřesahovalo */}
            <div className="relative h-12 mx-5">
                <div className="absolute inset-x-0 bottom-2 h-2.5 rounded-full bg-secondary overflow-hidden">
                    <div className="car-track h-full rounded-full bg-primary transition-[width] duration-[1400ms] ease-in-out" style={{ width: `${pct}%` }} />
                </div>
                <div className="car-track absolute bottom-3 -translate-x-1/2 transition-[left] duration-[1400ms] ease-in-out" style={{ left: `${pct}%` }}>
                    {/* Šedý kouř z výfuku (vlevo vzadu) - jen když autíčko jede na další krok */}
                    <div key={`smoke-${step}`} aria-hidden="true" className="pointer-events-none absolute left-[2px] bottom-[3px] h-0 w-0" style={{ animation: 'car-smoke-wrap 1.4s linear both' }}>
                        {[0, 1, 2, 3, 4].map(i => (
                            <span key={i} className="car-smoke absolute -left-1 -top-1 block h-3 w-3 rounded-full bg-gray-400/70 blur-[1px]" style={{ animationDelay: `${i * 0.2}s` }} />
                        ))}
                    </div>
                    <div key={step} className="car-bounce">
                        <svg width="40" height="26" viewBox="0 0 40 26" aria-hidden="true" className="drop-shadow">
                            <path d="M3 17c0-2 1-3 3-3.5l4-6.5c.6-1 1.7-1.5 2.8-1.5h11.4c1.2 0 2.3.6 3 1.600L31 14c3 .4 6 1 6 3.500V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" fill="#087F78" />
                            <path d="M13 8.500h6V14h-9.200zM21.500 8.500h5.200l3 5.500h-8.200z" fill="#E6F4F1" />
                            <circle cx="11" cy="21" r="4" fill="#1F2937" /><circle cx="11" cy="21" r="1.600" fill="#D1D5DB" />
                            <circle cx="30" cy="21" r="4" fill="#1F2937" /><circle cx="30" cy="21" r="1.600" fill="#D1D5DB" />
                            <rect x="35" y="15" width="3" height="2" rx="1" fill="#FCD34D" />
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DatasetsResponse, Place } from '../types/api';
import { TAG_LABELS } from '../constants';

// Číslo "naběhne" od nuly (ease-out, ~1,2 s)
function CountUp({ value }: { value: number }) {
    const [shown, setShown] = useState(0);
    useEffect(() => {
        let frame = 0;
        const start = performance.now();
        const tick = (now: number) => {
            const t = Math.min(1, (now - start) / 1200);
            setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
            if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [value]);
    return <>{shown}</>;
}

function lastUpdateLabel(iso: string | null) {
    if (!iso) return '–';
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'dnes';
    if (d.toDateString() === yesterday.toDateString()) return 'včera';
    return d.toLocaleDateString('cs-CZ');
}

export default function DataCounter({ stats, places }: { stats: DatasetsResponse | null; places: Place[] }) {
    // Zajímavost z dat: náhodný typ místa (prameny, muzea, rozhledny...) - při každé návštěvě jiný
    const [fact] = useState(() => {
        const keys = Object.keys(TAG_LABELS);
        return keys[Math.floor(Math.random() * keys.length)];
    });
    if (!stats) return null;
    const factCount = places.filter(p => p.tags.includes(fact)).length;

    const items = [
        { value: stats.places_from_datazapad, label: 'turistických míst' },
        { value: stats.datasets.length, label: 'datových sad' },
        ...(factCount ? [{ value: factCount, label: TAG_LABELS[fact] }] : []),
    ];

    return (
        <section className="relative z-20 -mt-16 md:-mt-24 px-4">
            <div className="container mx-auto max-w-5xl bg-white rounded-3xl shadow-xl border border-secondary p-6 md:p-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                    {items.map(item => (
                        <div key={item.label}>
                            <p className="text-4xl md:text-5xl font-extrabold text-primary"><CountUp value={item.value} /></p>
                            <p className="text-gray-600 mt-1">{item.label}</p>
                        </div>
                    ))}
                    <div>
                        <p className="text-4xl md:text-5xl font-extrabold text-primary">✓</p>
                        <p className="text-gray-600 mt-1">aktualizováno {lastUpdateLabel(stats.last_import)}</p>
                    </div>
                </div>
                <p className="text-center text-sm text-gray-500 mt-6">
                    Data z <a href="https://www.datazapad.cz/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Katalogu otevřených dat Karlovarského kraje – DataZápad</a>
                    {' · '}
                    <Link to="/o-datech" className="text-primary underline">přehled použitých dat</Link>
                </p>
            </div>
        </section>
    );
}

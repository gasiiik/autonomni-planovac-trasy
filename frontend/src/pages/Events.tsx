import { useEffect, useState } from 'react';
import {
    Baby, CalendarDays, Clapperboard, Drama, ExternalLink, Frame, GraduationCap, HeartPulse, Map, MapPin, Music,
    Palette, PartyPopper, Sparkles, Star, Tent, Trophy, UtensilsCrossed,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Location } from '../types/api';
import { fetchLocations } from '../services/apiClient';
import { EVENT_CATEGORIES, EVENTS_BASE, EVENTS_CALENDAR_URL, cityEventsUrl, eventCategoryUrl } from '../utils/events';

const CATEGORY_ICON: Record<string, LucideIcon> = {
    festivals: Tent, music: Music, theatre: Drama, children: Baby, exhibitions: Frame, significant: Star,
    social: PartyPopper, gastronomie: UtensilsCrossed, sport: Trophy, tours: Map, workshops: Palette,
    cinema: Clapperboard, educational: GraduationCap, zdravi: HeartPulse, other: Sparkles,
};

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

export default function Events() {
    const [towns, setTowns] = useState<{ name: string; url: string }[]>([]);

    // Obce z naší databáze, které mají v kalendáři kraje vlastní stránku
    useEffect(() => {
        fetchLocations()
            .then((locs: Location[]) => setTowns(locs
                .map(l => ({ name: l.name, url: cityEventsUrl(l.name) }))
                .filter((t): t is { name: string; url: string } => t.url !== null)))
            .catch(() => setTowns([]));
    }, []);

    return (
        <div className="container mx-auto pt-28 pb-16 px-4 max-w-6xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">Co se děje v kraji</p>
            <h1 className="text-3xl md:text-4xl font-bold text-primary-dark mt-1 mb-4">Kalendář akcí</h1>
            <p className="text-lg text-gray-700 max-w-3xl mb-8 leading-relaxed">
                Festivaly, koncerty, divadlo, trhy i akce pro děti z celého Karlovarského kraje najdeš v oficiálním kalendáři kraje{' '}
                <a href={EVENTS_BASE} {...external} className="text-primary font-semibold underline">Kam na západě</a>.
                Vyber, co tě zajímá – otevře se přehled aktuálních akcí.
            </p>

            <a href={EVENTS_CALENDAR_URL} {...external}
                className="inline-flex items-center gap-2 bg-accent text-primary-dark px-8 py-4 rounded-full font-bold hover:bg-yellow-400 transition shadow-md mb-12">
                <CalendarDays size={20} aria-hidden="true" /> Otevřít celý kalendář akcí <ExternalLink size={16} aria-hidden="true" />
            </a>

            <h2 className="text-2xl font-bold text-primary-dark mb-5">Podle druhu akce</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-14">
                {EVENT_CATEGORIES.map(c => {
                    const Icon = CATEGORY_ICON[c.slug] ?? Sparkles;
                    return (
                        <a key={c.slug} href={eventCategoryUrl(c.slug)} {...external}
                            className="group flex flex-col items-start gap-3 p-5 rounded-2xl bg-secondary hover:bg-primary hover:text-white transition shadow-sm hover:shadow-lg">
                            <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-white text-primary group-hover:bg-white/15 group-hover:text-accent transition">
                                <Icon size={22} strokeWidth={2.25} aria-hidden="true" />
                            </span>
                            <span className="font-semibold text-primary-dark group-hover:text-white leading-snug">{c.label}</span>
                        </a>
                    );
                })}
            </div>

            {towns.length > 0 && (
                <>
                    <h2 className="text-2xl font-bold text-primary-dark mb-5">Podle obce</h2>
                    <div className="flex flex-wrap gap-2 mb-14">
                        {towns.map(t => (
                            <a key={t.url} href={t.url} {...external}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-300 text-gray-700 hover:border-primary hover:text-primary transition">
                                <MapPin size={15} aria-hidden="true" /> {t.name}
                            </a>
                        ))}
                    </div>
                </>
            )}

            <p className="text-sm text-gray-500 border-t border-gray-100 pt-6">
                Akce zveřejňuje a spravuje Karlovarský kraj v kalendáři{' '}
                <a href={EVENTS_BASE} {...external} className="underline hover:text-primary">kamnazapade.cz</a>.
                Aplikace na něj jen odkazuje – před cestou si údaje o akci ověř u pořadatele.
            </p>
        </div>
    );
}

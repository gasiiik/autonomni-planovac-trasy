import {
    Activity, Bike, Car, Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun,
    FerrisWheel, Footprints, Landmark, PartyPopper, Snowflake, Sun, Trees, UtensilsCrossed,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Category } from '../types/api';
import { CATEGORY_COLORS } from '../constants';

// Jednotná sada ikon (Lucide) místo emoji - stejný styl na všech systémech, barvy z designu

const CATEGORY_ICON: Record<Category, LucideIcon> = {
    SIGHTSEEING: Landmark,
    PARK: Trees,
    FUN: FerrisWheel,
    GASTRO: UtensilsCrossed,
    RUNNING: Activity,
    FESTIVAL: PartyPopper,
};

const TRANSPORT_ICON: Record<string, LucideIcon> = {
    CAR: Car,
    BIKE: Bike,
    WALK: Footprints,
};

// Kategorie jako barevný odznak (bílá ikona v kroužku barvy kategorie)
export function CategoryBadge({ category, size = 28, className = '' }: { category: Category; size?: number; className?: string }) {
    const Icon = CATEGORY_ICON[category] ?? Landmark;
    return (
        <span className={`inline-flex items-center justify-center rounded-full shrink-0 ${className}`}
            style={{ width: size, height: size, background: CATEGORY_COLORS[category] }}>
            <Icon size={Math.round(size * 0.55)} color="#fff" strokeWidth={2.25} aria-hidden="true" />
        </span>
    );
}

// Samotná ikona kategorie (např. velká bílá ikona na náhradním obrázku místa bez fotky)
export function CategoryGlyph({ category, size = 48, color = '#fff', strokeWidth = 1.5 }: {
    category: Category; size?: number; color?: string; strokeWidth?: number;
}) {
    const Icon = CATEGORY_ICON[category] ?? Landmark;
    return <Icon size={size} color={color} strokeWidth={strokeWidth} aria-hidden="true" />;
}

// Štítek kategorie: odznak + název
export function CategoryTag({ category, label }: { category: Category; label: string }) {
    return (
        <span className="inline-flex items-center gap-1.5">
            <CategoryBadge category={category} size={20} />
            <span>{label}</span>
        </span>
    );
}

export function TransportIcon({ mode, size = 18, className = '' }: { mode: string; size?: number; className?: string }) {
    const Icon = TRANSPORT_ICON[mode] ?? Car;
    return <Icon size={size} className={className} strokeWidth={2.25} aria-hidden="true" />;
}

// WMO kód počasí (Open-Meteo) -> barevná ikona
const WEATHER: { max: number; icon: LucideIcon; color: string }[] = [
    { max: 0, icon: Sun, color: '#EAB308' },
    { max: 2, icon: CloudSun, color: '#F59E0B' },
    { max: 3, icon: Cloud, color: '#64748B' },
    { max: 48, icon: CloudFog, color: '#94A3B8' },
    { max: 57, icon: CloudDrizzle, color: '#3B82F6' },
    { max: 67, icon: CloudRain, color: '#2563EB' },
    { max: 77, icon: Snowflake, color: '#38BDF8' },
    { max: 82, icon: CloudRain, color: '#2563EB' },
    { max: 86, icon: CloudSnow, color: '#38BDF8' },
    { max: 99, icon: CloudLightning, color: '#7C3AED' },
];

export function WeatherIcon({ code, size = 18 }: { code: number; size?: number }) {
    const w = WEATHER.find(x => code <= x.max) ?? WEATHER[WEATHER.length - 1];
    const Icon = w.icon;
    return <Icon size={size} color={w.color} strokeWidth={2.25} aria-hidden="true" />;
}

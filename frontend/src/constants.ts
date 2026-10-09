import type { Category, PlanRequest } from './types/api';

export const CATEGORY_LABELS: Record<Category, string> = {
    SIGHTSEEING: 'Památky',
    PARK: 'Příroda',
    FUN: 'Zábava',
    GASTRO: 'Jídlo a pití',
    RUNNING: 'Běh',
    FESTIVAL: 'Akce',
};

export const CATEGORY_ICONS: Record<Category, string> = {
    SIGHTSEEING: '🏰',
    PARK: '🌲',
    FUN: '🎢',
    GASTRO: '🍽️',
    RUNNING: '🏃',
    FESTIVAL: '🎪',
};

// Barvy kategorií (značky na mapě, náhradní obrázek místa bez fotky)
export const CATEGORY_COLORS: Record<Category, string> = {
    SIGHTSEEING: '#B45309',
    PARK: '#15803D',
    FUN: '#7C3AED',
    GASTRO: '#DC2626',
    RUNNING: '#0284C7',
    FESTIVAL: '#DB2777',
};

// Typy míst z DataZápadu (tagy) - pro "Věděli jste?" a filtry
export const TAG_LABELS: Record<string, string> = {
    PRAMEN: 'přístupných pramenů',
    MUZEUM: 'muzeí a galerií',
    ZAMEK: 'zámků',
    HRAD: 'hradů a zřícenin',
    ROZHLEDNA: 'rozhleden',
    AQUAPARK: 'aquaparků, koupališť a bazénů',
    KOSTEL: 'náboženských památek',
    FARMA: 'farem a statků',
    LANOVKA: 'lanových a zábavních center',
    TECHNIKA: 'technických památek',
    ZOO: 'ZOO a minizoo',
};

export const TRANSPORT_LABELS: Record<string, string> = {
    CAR: 'Autem',
    BIKE: 'Na kole',
    WALK: 'Pěšky',
};

export const TRANSPORT_ICONS: Record<string, string> = {
    CAR: '🚗',
    BIKE: '🚲',
    WALK: '🚶',
};

export const DIFFICULTY_LABELS: Record<string, string> = {
    EASY: 'Lehká',
    MEDIUM: 'Střední',
    HARD: 'Náročná',
};

export const MONTHS = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];

// WMO kódy počasí (Open-Meteo) -> ikona a popis
export function weatherInfo(code: number): { icon: string; label: string } {
    if (code === 0) return { icon: '☀️', label: 'jasno' };
    if (code <= 2) return { icon: '🌤️', label: 'polojasno' };
    if (code === 3) return { icon: '☁️', label: 'zataženo' };
    if (code <= 48) return { icon: '🌫️', label: 'mlha' };
    if (code <= 67) return { icon: '🌧️', label: 'déšť' };
    if (code <= 77) return { icon: '❄️', label: 'sníh' };
    if (code <= 82) return { icon: '🌦️', label: 'přeháňky' };
    if (code <= 86) return { icon: '🌨️', label: 'sněhové přeháňky' };
    return { icon: '⛈️', label: 'bouřky' };
}

// Tematické výlety na jedno kliknutí (úvodní stránka). Start = název obce z DB.
export interface Theme {
    title: string;
    description: string;
    icon: string;
    start: string;
    request: Omit<PlanRequest, 'location_id' | 'time_from' | 'time_to'>;
}

export const THEMES: Theme[] = [
    {
        title: 'Lázeňský den v Karlových Varech',
        description: 'Kolonády, prameny, muzea a oběd – vše pěšky po centru.',
        icon: '♨️',
        start: 'Karlovy Vary',
        request: { transport_mode: 'WALK', route_type: 'LOOP', interests: ['SIGHTSEEING', 'GASTRO'], difficulty: 'MEDIUM', willing_to_pay_entry: true },
    },
    {
        title: 'Hrady a zámky na Sokolovsku',
        description: 'Gotický Loket a další památky v okolí autem.',
        icon: '🏰',
        start: 'Loket',
        request: { transport_mode: 'CAR', route_type: 'LOOP', interests: ['SIGHTSEEING', 'GASTRO'], difficulty: 'MEDIUM', willing_to_pay_entry: true },
    },
    {
        title: 'Den s dětmi',
        description: 'ZOO, aquaparky, lanová centra a farmy v okolí Chebu.',
        icon: '🧒',
        start: 'Cheb',
        request: { transport_mode: 'CAR', route_type: 'LOOP', interests: ['FUN', 'GASTRO'], difficulty: 'MEDIUM', has_children: true, willing_to_pay_entry: true },
    },
    {
        title: 'Mariánské Lázně na kole',
        description: 'Lázeňské město, prameny a příroda Slavkovského lesa.',
        icon: '🚲',
        start: 'Mariánské Lázně',
        request: { transport_mode: 'BIKE', route_type: 'LOOP', interests: ['SIGHTSEEING', 'PARK', 'GASTRO'], difficulty: 'MEDIUM', willing_to_pay_entry: true },
    },
];

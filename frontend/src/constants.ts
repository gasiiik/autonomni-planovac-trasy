import type { Category, PlanRequest } from './types/api';

export const CATEGORY_LABELS: Record<Category, string> = {
    SIGHTSEEING: 'Památky',
    PARK: 'Příroda',
    FUN: 'Zábava',
    GASTRO: 'Jídlo a pití',
    RUNNING: 'Běh',
    FESTIVAL: 'Akce',
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

// Zájmy = kategorie míst v backendu (data z DataZápad) - průvodce výletu i dovolené
export const INTERESTS: { value: Category; label: string; hint: string }[] = [
    { value: 'SIGHTSEEING', label: 'Památky', hint: 'hrady, zámky, muzea, rozhledny, prameny' },
    { value: 'PARK', label: 'Příroda', hint: 'přírodní pozoruhodnosti, zahrady, arboreta' },
    { value: 'FUN', label: 'Zábava a sport', hint: 'ZOO, aquaparky, lanová centra, golf, lyžování, koně' },
];
export const ALL_INTERESTS: Category[] = ['SIGHTSEEING', 'PARK', 'FUN'];

export const FOOD_PREFERENCES = [
    { value: 'PIVOVAR', label: 'Pivovar' },
    { value: 'CAFE', label: 'Kavárna' },
    { value: 'VEGETARIAN', label: 'Vegetariánské' },
];

// Barvy dnů dovolené (přehledová mapa, záložky dnů)
export const DAY_COLORS = ['#087F78', '#B45309', '#7C3AED', '#DC2626', '#0284C7', '#15803D', '#DB2777'];

export const TRANSPORT_LABELS: Record<string, string> = {
    CAR: 'Autem',
    BIKE: 'Na kole',
    WALK: 'Pěšky',
};


export const DIFFICULTY_LABELS: Record<string, string> = {
    EASY: 'Lehká',
    MEDIUM: 'Střední',
    HARD: 'Náročná',
};

export const MONTHS = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];


// Tematické výlety na jedno kliknutí (úvodní stránka). Start = název obce z DB, fotka = místo z dat.
export interface Theme {
    title: string;
    description: string;
    start: string;
    photoPlace: string; // název místa v DB, jehož fotka je na kartě
    request: Omit<PlanRequest, 'location_id' | 'time_from' | 'time_to'>;
}

export const THEMES: Theme[] = [
    {
        title: 'Lázeňské Karlovy Vary',
        description: 'Kolonády, prameny, muzea a oběd. Všechno pěšky po centru.',
        start: 'Karlovy Vary',
        photoPlace: 'Mlýnská kolonáda',
        request: { transport_mode: 'WALK', route_type: 'LOOP', interests: ['SIGHTSEEING', 'GASTRO'], difficulty: 'MEDIUM', willing_to_pay_entry: true },
    },
    {
        title: 'Hrad Loket a okolí',
        description: 'Gotický hrad nad Ohří a další památky Sokolovska.',
        start: 'Loket',
        photoPlace: 'Hrad Loket',
        request: { transport_mode: 'CAR', route_type: 'LOOP', interests: ['SIGHTSEEING', 'GASTRO'], difficulty: 'MEDIUM', willing_to_pay_entry: true },
    },
    {
        title: 'Den s dětmi na Chebsku',
        description: 'Zvířata, bazény, lanová centra a farmy v okolí Chebu.',
        start: 'Cheb',
        photoPlace: 'Zookoutek Amerika',
        request: { transport_mode: 'CAR', route_type: 'LOOP', interests: ['FUN', 'GASTRO'], difficulty: 'MEDIUM', has_children: true, willing_to_pay_entry: true },
    },
    {
        title: 'Mariánské Lázně na kole',
        description: 'Zpívající fontána, prameny a lesy Slavkovského lesa.',
        start: 'Mariánské Lázně',
        photoPlace: 'Zpívající fontána',
        request: { transport_mode: 'BIKE', route_type: 'LOOP', interests: ['SIGHTSEEING', 'PARK', 'GASTRO'], difficulty: 'MEDIUM', willing_to_pay_entry: true },
    },
];

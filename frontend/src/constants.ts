import type { Category } from './types/api';

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

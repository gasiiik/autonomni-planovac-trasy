import { Heart } from 'lucide-react';
import { toggleFavorite, useFavorites } from '../utils/favorites';
import type { FavoritePlace } from '../utils/favorites';

// Srdíčko u místa: přidá / odebere z oblíbených
export default function FavoriteButton({ place, withLabel = false, className = '' }: { place: FavoritePlace; withLabel?: boolean; className?: string }) {
    const favorites = useFavorites();
    const active = favorites.some(f => f.id === place.id);
    const label = active ? 'Odebrat z oblíbených' : 'Přidat do oblíbených';
    return (
        <button type="button" onClick={() => toggleFavorite(place)} aria-pressed={active} title={label} aria-label={withLabel ? undefined : label}
            className={`inline-flex items-center gap-1.5 rounded-full font-semibold transition print:hidden ${withLabel ? 'px-4 py-2 text-sm' : 'p-2'} ${active
                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                : 'bg-white/90 text-gray-500 hover:text-red-600 border border-gray-200'} ${className}`}>
            <Heart size={withLabel ? 18 : 20} fill={active ? 'currentColor' : 'none'} aria-hidden="true" />
            {withLabel && (active ? 'V oblíbených' : 'Do oblíbených')}
        </button>
    );
}

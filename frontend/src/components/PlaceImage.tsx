import { useState } from 'react';
import type { Category } from '../types/api';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../constants';

// Fotka místa; když chybí nebo se nenačte, barevná plocha s ikonou kategorie
export default function PlaceImage({ src, alt, category, className = '' }: {
    src?: string | null; alt: string; category?: Category; className?: string;
}) {
    const [failed, setFailed] = useState(false);
    const color = category ? CATEGORY_COLORS[category] : '#087F78';

    if (src && !failed) {
        return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={`object-cover ${className}`} />;
    }
    return (
        <div className={`flex items-center justify-center ${className}`}
            style={{ background: `linear-gradient(135deg, ${color}, ${color}99)` }} aria-label={alt}>
            <span className="text-5xl drop-shadow">{category ? CATEGORY_ICONS[category] : '📍'}</span>
        </div>
    );
}

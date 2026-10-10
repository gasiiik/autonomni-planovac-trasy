import { useState } from 'react';
import type { Category } from '../types/api';
import { CATEGORY_COLORS } from '../constants';
import { CategoryGlyph } from './Icons';

// Odkud fotka je: Wikipedie/Commons (volné licence), jinak náhledový obrázek z webu provozovatele
function photoCredit(src: string): string {
    if (/wikimedia\.org|wikipedia\.org/.test(src)) return 'Foto: Wikimedia Commons';
    try {
        return `Foto: web provozovatele (${new URL(src).hostname.replace(/^www\./, '')})`;
    } catch {
        return 'Foto: web provozovatele';
    }
}

// Fotka místa; když chybí nebo se nenačte, barevná plocha s ikonou kategorie
export default function PlaceImage({ src, alt, category, className = '', credit = 'bottom', imgClassName = '' }: {
    src?: string | null; alt: string; category?: Category; className?: string;
    credit?: 'bottom' | 'top' | false; imgClassName?: string;
}) {
    const [failed, setFailed] = useState(false);
    const color = category ? CATEGORY_COLORS[category] : '#087F78';

    if (src && !failed) {
        return (
            <div className={`relative overflow-hidden ${className}`}>
                <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={`w-full h-full object-cover ${imgClassName}`} />
                {credit && (
                    <span className={`absolute right-0 z-10 bg-black/45 text-white/90 text-[10px] px-2 py-0.5 ${credit === 'top' ? 'top-0 rounded-bl-md' : 'bottom-0 rounded-tl-md'}`}>
                        {photoCredit(src)}
                    </span>
                )}
            </div>
        );
    }
    return (
        <div className={`flex items-center justify-center ${className}`}
            style={{ background: `linear-gradient(135deg, ${color}, ${color}99)` }} aria-label={alt}>
            <span className="flex items-center justify-center w-20 h-20 rounded-full bg-white/15 ring-1 ring-white/30">
                <CategoryGlyph category={category ?? 'SIGHTSEEING'} size={40} />
            </span>
        </div>
    );
}

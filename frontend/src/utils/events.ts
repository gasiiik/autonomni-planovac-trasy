// Odkazy do oficiálního kalendáře akcí Karlovarského kraje "Kam na západě" (kamnazapade.cz).
// Data z kalendáře nepřebíráme (API není veřejné a licence k obsahu má jen kraj) - jen na něj odkazujeme.

export const EVENTS_BASE = 'https://kamnazapade.cz';
export const EVENTS_CALENDAR_URL = `${EVENTS_BASE}/kalendar`;

export const EVENT_CATEGORIES: { slug: string; label: string }[] = [
    { slug: 'festivals', label: 'Festivaly' },
    { slug: 'music', label: 'Hudba' },
    { slug: 'theatre', label: 'Divadlo' },
    { slug: 'children', label: 'Pro děti a rodiny' },
    { slug: 'exhibitions', label: 'Výstavy, muzea a galerie' },
    { slug: 'significant', label: 'Významné akce a UNESCO' },
    { slug: 'social', label: 'Společenské a zábavní akce' },
    { slug: 'gastronomie', label: 'Gastronomie' },
    { slug: 'sport', label: 'Sport' },
    { slug: 'tours', label: 'Prohlídky' },
    { slug: 'workshops', label: 'Workshopy a kurzy' },
    { slug: 'cinema', label: 'Kino' },
    { slug: 'educational', label: 'Přednášky a konference' },
    { slug: 'zdravi', label: 'Zdraví' },
    { slug: 'other', label: 'Ostatní' },
];

export const eventCategoryUrl = (slug: string) => `${EVENTS_BASE}/categories/${slug}`;

// Obce, které mají v kalendáři vlastní stránku (podle sitemap.xml kalendáře)
const CITY_SLUGS = new Set([
    'abertamy', 'as', 'becov-nad-teplou', 'bochov', 'bozi-dar', 'brezova', 'frantiskovy-lazne', 'habartov', 'hazlov',
    'horni-blatna', 'horni-slavkov', 'hranice', 'hroznetin', 'cheb', 'chodov', 'chyse', 'jachymov', 'karlovy-vary',
    'kolova', 'kraslice', 'krasne-udoli', 'krasno', 'kynsperk-nad-ohri', 'lazne-kynzvart', 'loket', 'luby',
    'marianske-lazne', 'merklin', 'nejdek', 'nova-role', 'nove-sedlo', 'obec-stedra', 'olovi', 'ostrov', 'plesna',
    'pomezi-nad-ohri', 'prebuz', 'rotava', 'skalna', 'sokolov', 'tepla', 'touzim', 'valec', 'zlutice',
]);
const CITY_SLUG_EXCEPTIONS: Record<string, string> = { stedra: 'obec-stedra' };

const slugify = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Odkaz na akce v obci; null, když obec v kalendáři vlastní stránku nemá
export function cityEventsUrl(cityName: string): string | null {
    const base = slugify(cityName);
    const slug = CITY_SLUG_EXCEPTIONS[base] ?? base;
    return CITY_SLUGS.has(slug) ? `${EVENTS_BASE}/cities/${slug}` : null;
}

// "Vaše poloha (u obce Cheb)" -> "Cheb"
export const townFromStartName = (name: string) => name.match(/u obce (.+)\)$/)?.[1] ?? name;

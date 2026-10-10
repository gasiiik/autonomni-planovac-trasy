import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ChevronDown, LocateFixed, MapPin, X } from 'lucide-react';
import type { Location } from '../types/api';

// Výběr výchozí obce: seznam se vždy otevírá směrem dolů (nativní <select> si směr volí prohlížeč)
// a jde v něm psát - hledá se bez ohledu na diakritiku ("bozi" najde Boží Dar).
// "Moje poloha" je samostatné tlačítko ve formuláři - v seznamu jsou jen obce.

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface Props {
    locations: Location[];
    value: string;                         // id vybrané obce
    startName?: string | null;             // vybraná "moje poloha"
    onSelect: (id: string) => void;
    onClearStart: () => void;
}

const NONE = -1; // nic zvýrazněného

export default function LocationPicker({ locations, value, startName, onSelect, onClearStart }: Props) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [highlight, setHighlight] = useState(NONE);
    const rootRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    const selected = locations.find(l => String(l.id) === value);

    // Obce začínající hledaným textem první, pak ty, které ho obsahují
    const filtered = useMemo(() => {
        const q = normalize(query.trim());
        if (!q) return locations;
        const starts = locations.filter(l => normalize(l.name).startsWith(q));
        const contains = locations.filter(l => !normalize(l.name).startsWith(q) && normalize(l.name).includes(q));
        return [...starts, ...contains];
    }, [locations, query]);

    // Klik mimo -> zavřít
    useEffect(() => {
        const onDown = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, []);

    // Zvýrazněnou položku držíme ve viditelné části seznamu
    useEffect(() => {
        listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
    }, [highlight, open]);

    const openList = () => {
        setOpen(true);
        setQuery('');
        const idx = locations.findIndex(l => String(l.id) === value);
        setHighlight(idx >= 0 ? idx : NONE); // zvýrazníme jen už vybranou obec
    };

    const choose = (index: number) => {
        if (filtered[index]) onSelect(String(filtered[index].id));
        else return; // Enter bez zvýrazněné obce nic nevybere
        setOpen(false);
        setQuery('');
    };

    const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
            e.preventDefault();
            openList();
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight(h => Math.min(h + 1, filtered.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight(h => Math.max(h - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            choose(highlight);
        } else if (e.key === 'Escape') {
            setOpen(false);
            setQuery('');
        }
    };

    if (startName) {
        return (
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl border-2 border-primary bg-secondary">
                <span className="flex items-center gap-2 font-semibold text-primary-dark">
                    <LocateFixed size={18} aria-hidden="true" /> {startName}
                </span>
                <button type="button" onClick={onClearStart} className="text-gray-500 hover:text-primary-dark" aria-label="Zrušit polohu a vybrat obec">
                    <X size={18} />
                </button>
            </div>
        );
    }

    const optionClass = (active: boolean) =>
        `flex items-center gap-2 px-4 py-2.5 cursor-pointer ${active ? 'bg-secondary text-primary-dark' : 'text-gray-800 hover:bg-secondary/60'}`;

    return (
        <div ref={rootRef} className="relative">
            <div className="relative">
                <input
                    type="text"
                    role="combobox"
                    aria-expanded={open}
                    aria-controls="location-listbox"
                    aria-autocomplete="list"
                    value={open ? query : selected?.name ?? ''}
                    placeholder={locations.length ? (selected?.name ?? 'Napiš nebo vyber obec…') : 'Načítám obce…'}
                    onFocus={openList}
                    onClick={() => !open && openList()}
                    onChange={e => { setQuery(e.target.value); setOpen(true); setHighlight(e.target.value ? 0 : NONE); }}
                    onKeyDown={onKeyDown}
                    disabled={!locations.length}
                    className="w-full border border-gray-300 rounded-xl p-3 pr-10 focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <ChevronDown size={20} className={`absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
            </div>

            {open && (
                <ul id="location-listbox" ref={listRef} role="listbox"
                    className="absolute left-0 right-0 top-full mt-1 z-30 max-h-72 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl py-1">
                    {filtered.map((l, i) => (
                        <li key={l.id} role="option" aria-selected={String(l.id) === value} data-active={highlight === i}
                            onMouseDown={e => { e.preventDefault(); choose(i); }}
                            onMouseEnter={() => setHighlight(i)}
                            className={optionClass(highlight === i)}>
                            <MapPin size={16} className="text-gray-400 shrink-0" aria-hidden="true" />
                            <span className={String(l.id) === value ? 'font-semibold' : ''}>{l.name}</span>
                        </li>
                    ))}
                    {filtered.length === 0 && <li className="px-4 py-3 text-gray-500">Žádná obec neodpovídá „{query}“.</li>}
                </ul>
            )}
        </div>
    );
}

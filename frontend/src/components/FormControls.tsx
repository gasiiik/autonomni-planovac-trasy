import type { ChangeEvent } from 'react';
import type { InputHTMLAttributes } from 'react';
import { Check } from 'lucide-react';

// Výběrová karta (radio / checkbox) s vlastním vzhledem: zaoblené rohy, hover, focus a vybraný stav
export function ChoiceCard({ type, name, value, checked, onChange, title, hint }: {
    type: 'radio' | 'checkbox'; name: string; value?: string; checked: boolean;
    onChange: (e: ChangeEvent<HTMLInputElement>) => void; title: string; hint?: string;
}) {
    return (
        <label className={`group relative flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition shadow-sm
            hover:shadow-md hover:border-primary focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2
            ${checked ? 'border-primary bg-secondary' : 'border-gray-200 bg-white'}`}>
            <input type={type} name={name} value={value} checked={checked} onChange={onChange} className="sr-only" />
            <span aria-hidden="true" className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border-2 transition
                ${type === 'radio' ? 'rounded-full' : 'rounded-lg'}
                ${checked ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white group-hover:border-primary'}`}>
                {checked && <Check size={14} strokeWidth={3} />}
            </span>
            <span className="min-w-0">
                <span className="block font-semibold text-primary-dark leading-tight">{title}</span>
                {hint && <span className="block text-sm text-gray-500 mt-0.5">{hint}</span>}
            </span>
        </label>
    );
}

// Číselné pole s jednotkou uvnitř (zaoblené, stejný vzhled jako ostatní prvky)
export function NumberField({ label, unit, ...input }: { label: string; unit: string } & InputHTMLAttributes<HTMLInputElement>) {
    return (
        <div>
            <label className="block text-primary-dark font-semibold mb-2" htmlFor={input.name}>{label}</label>
            <div className="relative">
                <input id={input.name} type="number" {...input}
                    className="w-full rounded-2xl border-2 border-gray-200 bg-white py-3 pl-4 pr-14 shadow-sm transition hover:border-primary focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">{unit}</span>
            </div>
        </div>
    );
}


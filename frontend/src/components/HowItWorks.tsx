import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { FEATURES, STEPS } from '../constants';

// Lišta "Jak to funguje" - vyjede zespodu nahoru, rozpracovaný plán zůstane pod ní
export default function HelpDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
    const closeRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!open) return;
        closeRef.current?.focus();
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';   // stránka pod lištou se neposouvá
        return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
    }, [open, onClose]);

    return (
        <div className={`print:hidden fixed inset-0 z-[60] transition-[visibility] duration-300 ${open ? 'visible' : 'invisible pointer-events-none'}`} aria-hidden={!open}>
            <div onClick={onClose} className={`absolute inset-0 bg-primary-dark/40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`} />
            <aside role="dialog" aria-modal="true" aria-labelledby="help-title"
                className={`absolute inset-x-0 bottom-0 max-h-[85vh] bg-white rounded-t-3xl shadow-2xl overflow-y-auto transition-transform duration-300 ${open ? 'translate-y-0' : 'translate-y-full'}`}>
                <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-secondary">
                    <div className="mx-auto mt-2 w-12 h-1.5 rounded-full bg-gray-300" aria-hidden="true" />
                    <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
                        <p id="help-title" className="text-sm font-semibold uppercase tracking-widest text-primary">Jak to funguje</p>
                        <button ref={closeRef} onClick={onClose} aria-label="Zavřít nápovědu"
                            className="w-10 h-10 rounded-full flex items-center justify-center text-primary-dark hover:bg-secondary transition">
                            <X size={22} aria-hidden="true" />
                        </button>
                    </div>
                </div>
                <div className="max-w-5xl mx-auto px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                    <div>
                        <h2 className="text-2xl font-bold text-primary-dark leading-tight mb-3">Celý den naplánovaný za pár vteřin</h2>
                        <p className="text-gray-700 leading-relaxed mb-6">
                            Nemusíš procházet desítky webů a hlídat, co má kdy otevřeno. KrušnoPlán vezme místa z otevřených dat
                            Karlovarského kraje a poskládá z nich trasu, která se ti vejde do dne.
                        </p>
                        <p className="font-semibold text-primary-dark mb-3">Na co myslíme za tebe</p>
                        <ul className="space-y-3">
                            {FEATURES.map(([Icon, text]) => (
                                <li key={text} className="flex items-start gap-3 text-gray-700">
                                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary text-primary shrink-0">
                                        <Icon size={18} strokeWidth={2.25} aria-hidden="true" />
                                    </span>
                                    <span className="pt-1">{text}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <ol className="space-y-3">
                        {STEPS.map(([title, text], i) => (
                            <li key={title} className="flex items-start gap-4 bg-secondary/60 rounded-2xl p-4">
                                <span className="shrink-0 w-11 text-4xl font-extrabold leading-none text-accent [text-shadow:0_1px_0_rgba(21,94,80,0.25)] tabular-nums">
                                    {String(i + 1).padStart(2, '0')}
                                </span>
                                <div>
                                    <h3 className="font-bold text-primary-dark mb-1">{title}</h3>
                                    <p className="text-sm text-gray-700 leading-relaxed">{text}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>
            </aside>
        </div>
    );
}

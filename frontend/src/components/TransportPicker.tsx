import { Accessibility } from 'lucide-react';
import type { PlanRequest } from '../types/api';
import { TRANSPORT_LABELS } from '../constants';
import { TransportIcon } from './Icons';

type Mode = PlanRequest['transport_mode'];

// Volba dopravy (auto / kolo / pěšky) + bezbariérová varianta, která se nabídne jen u chůze.
// Společné pro průvodce výletem i dovolenou.
export default function TransportPicker({ mode, wheelchair, onMode, onWheelchair, hint = true }: {
    mode: Mode; wheelchair: boolean; onMode: (m: Mode) => void; onWheelchair: (on: boolean) => void; hint?: boolean;
}) {
    const walking = mode === 'WALK';
    return (
        <div>
            <label className="block text-primary-dark font-semibold mb-3">Způsob dopravy</label>
            <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Způsob dopravy">
                {(['CAR', 'BIKE', 'WALK'] as const).map(m => (
                    <label key={m} className={`flex flex-col items-center gap-1 p-4 rounded-2xl border-2 cursor-pointer transition shadow-sm hover:shadow-md hover:border-primary focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${mode === m ? 'border-primary bg-secondary' : 'border-gray-200 bg-white'}`}>
                        <input type="radio" name="transport_mode" value={m} checked={mode === m} onChange={() => onMode(m)} className="sr-only" />
                        <TransportIcon mode={m} size={34} className="text-primary" />
                        <span className="font-semibold">{TRANSPORT_LABELS[m]}</span>
                    </label>
                ))}
            </div>
            {hint && <p className="text-sm text-gray-500 mt-2">Pěšky hledáme do 3 km, na kole do 15 km a autem do 40 km od startu.</p>}
            {/* Bezbariérovost: plynule se rozbalí jen u chůze */}
            <div className={`grid transition-all duration-300 ease-in-out ${walking ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0 mt-0'}`} aria-hidden={!walking}>
                <div className="overflow-hidden">
                    <label className={`flex items-center justify-between gap-4 p-4 rounded-2xl border-2 cursor-pointer transition shadow-sm hover:shadow-md hover:border-primary focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${wheelchair ? 'border-primary bg-secondary' : 'border-gray-200 bg-white'}`}>
                        <span className="flex items-center gap-3">
                            <Accessibility size={26} className="text-primary shrink-0" aria-hidden="true" />
                            <span>
                                <span className="block font-semibold text-primary-dark">Bezbariérová trasa / kočárek</span>
                                <span className="block text-sm text-gray-500">Bez schodů a prudkých stoupání, pomalejší tempo, bez rozhleden a hradů.</span>
                            </span>
                        </span>
                        <input type="checkbox" name="wheelchair_accessible" checked={wheelchair} onChange={e => onWheelchair(e.target.checked)}
                            tabIndex={walking ? 0 : -1} className="sr-only peer" />
                        <span aria-hidden="true" className="relative h-7 w-12 shrink-0 rounded-full bg-gray-300 transition peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-all peer-checked:after:translate-x-5" />
                    </label>
                </div>
            </div>
        </div>
    );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Location } from '../types/api';
import { fetchLocations } from '../services/apiClient';

export default function Wizard() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [locations, setLocations] = useState<Location[]>([]);
    const [formData, setFormData] = useState({
        location_id: '',
        date: new Date().toISOString().split('T')[0],
        time_from: '09:00',
        time_to: '18:00',
        transport_mode: 'CAR',
        route_type: 'LOOP',
        interests: [] as string[]
    });

    useEffect(() => {
        fetchLocations().then(setLocations);
    }, []);

    const handleChange = (e: any) => {
        const { name, value, type, checked } = e.target;
        if (type === 'checkbox') {
            setFormData(prev => ({
                ...prev,
                interests: checked 
                    ? [...prev.interests, value]
                    : prev.interests.filter(i => i !== value)
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const nextStep = () => setStep(s => Math.min(s + 1, 6));
    const prevStep = () => setStep(s => Math.max(s - 1, 1));

    const handleSubmit = (e: any) => {
        e.preventDefault();
        // Uložit do session storage
        sessionStorage.setItem('planRequest', JSON.stringify({
            location_id: parseInt(formData.location_id) || (locations[0]?.id || 1),
            time_from: `${formData.date} ${formData.time_from}:00`,
            time_to: `${formData.date} ${formData.time_to}:00`,
            transport_mode: formData.transport_mode,
            route_type: formData.route_type,
            interests: formData.interests.length > 0 ? formData.interests : ['SIGHTSEEING', 'NATURE']
        }));
        navigate('/result');
    };

    return (
        <div className="container mx-auto pt-28 pb-12 px-4 max-w-3xl">
            <div className="mb-8">
                <p className="text-primary-dark font-medium mb-2">Krok {step} z 6</p>
                <div className="w-full bg-secondary rounded-full h-2.5">
                    <div className="bg-primary h-2.5 rounded-full transition-all duration-300" style={{ width: `${(step / 6) * 100}%` }}></div>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-lg p-8 border border-secondary">
                <form onSubmit={step === 6 ? handleSubmit : (e) => { e.preventDefault(); nextStep(); }}>
                    
                    {step === 1 && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-primary-dark">Krok 1 – Čas a datum</h2>
                            <div>
                                <label className="block text-primary-dark mb-2">Datum výletu</label>
                                <input type="date" name="date" value={formData.date} onChange={handleChange} className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-primary" required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-primary-dark mb-2">Čas odjezdu</label>
                                    <input type="time" name="time_from" value={formData.time_from} onChange={handleChange} className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-primary" required />
                                </div>
                                <div>
                                    <label className="block text-primary-dark mb-2">Čas návratu</label>
                                    <input type="time" name="time_to" value={formData.time_to} onChange={handleChange} className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-primary" required />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-primary-dark">Krok 2 – Výchozí místo a doprava</h2>
                            <div>
                                <label className="block text-primary-dark mb-2">Výchozí místo</label>
                                <select name="location_id" value={formData.location_id} onChange={handleChange} className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-primary" required>
                                    <option value="" disabled>Vyberte místo...</option>
                                    {locations.map(loc => (
                                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-primary-dark mb-2">Způsob dopravy</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center space-x-2">
                                        <input type="radio" name="transport_mode" value="CAR" checked={formData.transport_mode === 'CAR'} onChange={handleChange} className="text-primary focus:ring-primary" />
                                        <span>Autem</span>
                                    </label>
                                    <label className="flex items-center space-x-2">
                                        <input type="radio" name="transport_mode" value="BIKE" checked={formData.transport_mode === 'BIKE'} onChange={handleChange} className="text-primary focus:ring-primary" />
                                        <span>Na kole</span>
                                    </label>
                                    <label className="flex items-center space-x-2">
                                        <input type="radio" name="transport_mode" value="WALK" checked={formData.transport_mode === 'WALK'} onChange={handleChange} className="text-primary focus:ring-primary" />
                                        <span>Pěšky</span>
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="block text-primary-dark mb-2">Návrat</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center space-x-2">
                                        <input type="radio" name="route_type" value="LOOP" checked={formData.route_type === 'LOOP'} onChange={handleChange} className="text-primary focus:ring-primary" />
                                        <span>Vrátit se zpět (Okruh)</span>
                                    </label>
                                    <label className="flex items-center space-x-2">
                                        <input type="radio" name="route_type" value="ONE_WAY" checked={formData.route_type === 'ONE_WAY'} onChange={handleChange} className="text-primary focus:ring-primary" />
                                        <span>Jednosměrný výlet</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-primary-dark">Krok 3 – Co chceš zažít?</h2>
                            <p className="text-gray-600">Vyber, co tě zajímá, nebo nás nech překvapit.</p>
                            <div className="grid grid-cols-2 gap-4">
                                {['NATURE', 'SIGHTSEEING', 'HISTORIC', 'VIEWPOINT', 'CULTURE', 'SPORT'].map(interest => (
                                    <label key={interest} className="flex items-center space-x-3 p-4 border rounded-xl hover:bg-secondary cursor-pointer transition">
                                        <input type="checkbox" name="interests" value={interest} checked={formData.interests.includes(interest)} onChange={handleChange} className="text-primary focus:ring-primary h-5 w-5 rounded" />
                                        <span>{interest === 'NATURE' ? 'Příroda a hory' : interest === 'SIGHTSEEING' ? 'Památky' : interest === 'HISTORIC' ? 'Hrady a zámky' : interest === 'VIEWPOINT' ? 'Výhledy' : interest === 'CULTURE' ? 'Kultura' : 'Aktivita'}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-primary-dark">Krok 4 – Jídlo a pití</h2>
                            <p className="text-gray-600">Chceš se během cesty najíst? (Tato funkce vyžaduje update backendu, viz zmenyback.md)</p>
                            <div className="grid grid-cols-2 gap-4">
                                <label className="flex items-center space-x-3 p-4 border rounded-xl hover:bg-secondary cursor-pointer transition">
                                    <input type="checkbox" name="interests" value="GASTRO" checked={formData.interests.includes('GASTRO')} onChange={handleChange} className="text-primary focus:ring-primary h-5 w-5 rounded" />
                                    <span>Zahrnout gastronomii (Obecně)</span>
                                </label>
                            </div>
                        </div>
                    )}

                    {step === 5 && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-primary-dark">Krok 5 – Rozpočet a další preference</h2>
                            <p className="text-gray-600">Další detaily pro přesnější výsledek. (Některé zatím backend nepodporuje)</p>
                            {/* Dummy fields for UI completion */}
                            <div>
                                <label className="block text-primary-dark mb-2">Ochota platit vstupné</label>
                                <select className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-primary">
                                    <option>Ano, chci vidět vše</option>
                                    <option>Ne, pouze zdarma</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {step === 6 && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-primary-dark">Krok 6 – Shrnutí</h2>
                            <div className="bg-secondary p-6 rounded-xl space-y-2">
                                <p><strong>Datum:</strong> {formData.date}</p>
                                <p><strong>Čas:</strong> {formData.time_from} - {formData.time_to}</p>
                                <p><strong>Doprava:</strong> {formData.transport_mode}</p>
                                <p><strong>Typ cesty:</strong> {formData.route_type}</p>
                                <p><strong>Zájmy:</strong> {formData.interests.join(', ') || 'Překvap mě'}</p>
                            </div>
                        </div>
                    )}

                    <div className="mt-8 flex justify-between">
                        {step > 1 ? (
                            <button type="button" onClick={prevStep} className="px-6 py-3 border border-primary text-primary font-bold rounded-full hover:bg-primary hover:text-white transition">
                                Zpět
                            </button>
                        ) : <div></div>}
                        
                        <button type="submit" className="px-8 py-3 bg-accent text-primary-dark font-bold rounded-full hover:bg-yellow-400 transition shadow-md">
                            {step === 6 ? 'Vytvořit výlet' : 'Pokračovat'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

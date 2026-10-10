#!/bin/bash
cd frontend/src

cat << 'FILE' > types/api.ts
export interface PlanRequest {
    location_id: number;
    time_from: string;
    time_to: string;
    transport_mode: string;
    route_type: string;
    interests: string[];
}

export interface Waypoint {
    lat: number;
    lng: number;
    name: string;
    type: string;
}

export interface ItineraryItem {
    type: string;
    start: string;
    end: string;
    mode?: string;
    distance_km?: number;
    duration_mins: number;
    title?: string;
    category?: string;
    lat?: number;
    lng?: number;
}

export interface PlanResponse {
    status: string;
    location: string;
    route_type: string;
    transport_mode: string;
    waypoints: Waypoint[];
    itinerary: ItineraryItem[];
    remaining_free_time_mins: number;
    total_planned_time: number;
}

export interface Location {
    id: number;
    name: string;
    lat: number;
    lng: number;
}
FILE

cat << 'FILE' > services/apiClient.ts
import { Location, PlanRequest, PlanResponse } from '../types/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

export const fetchLocations = async (): Promise<Location[]> => {
    try {
        const res = await fetch(`${API_URL}/locations`);
        if (!res.ok) throw new Error('Failed to fetch locations');
        return await res.json();
    } catch (error) {
        console.error(error);
        return [
            { id: 1, name: 'Praha', lat: 50.0755, lng: 14.4378 },
            { id: 2, name: 'Brno', lat: 49.1951, lng: 16.6068 }
        ]; // Fallback pro demonstraci
    }
}

export const generatePlan = async (request: PlanRequest): Promise<PlanResponse> => {
    const res = await fetch(`${API_URL}/planner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
    });
    if (!res.ok) throw new Error('Failed to generate plan');
    return await res.json();
}
FILE

cat << 'FILE' > App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './layouts/Layout';
import Home from './pages/Home';
import Wizard from './pages/Wizard';
import Result from './pages/Result';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="wizard" element={<Wizard />} />
          <Route path="result" element={<Result />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App;
FILE

cat << 'FILE' > layouts/Layout.tsx
import { Outlet, Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export default function Layout() {
    return (
        <div className="min-h-screen flex flex-col">
            <header className="bg-primary text-white p-4 shadow-md">
                <div className="container mx-auto flex items-center justify-between">
                    <Link to="/" className="flex items-center space-x-2 text-2xl font-bold">
                        <Compass className="w-8 h-8 text-accent" />
                        <span>KrušnoPlán</span>
                    </Link>
                    <nav className="hidden md:flex space-x-4 font-medium">
                        <Link to="/" className="hover:text-accent transition">Domů</Link>
                        <Link to="/wizard" className="hover:text-accent transition">Naplánovat výlet</Link>
                    </nav>
                </div>
            </header>
            <main className="flex-grow bg-[#FFFFFF]">
                <Outlet />
            </main>
            <footer className="bg-primary-dark text-white p-6 text-center">
                <p>&copy; {new Date().getFullYear()} KrušnoPlán. Všechna práva vyhrazena.</p>
            </footer>
        </div>
    )
}
FILE

cat << 'FILE' > pages/Home.tsx
import { Link } from 'react-router-dom';

export default function Home() {
    return (
        <div>
            {/* Hero Section */}
            <section className="relative h-[80vh] flex items-center justify-center bg-primary-dark text-white text-center px-4 overflow-hidden">
                <div className="absolute inset-0 bg-primary opacity-80 mix-blend-multiply"></div>
                <div className="relative z-10 max-w-2xl">
                    <h1 className="text-5xl md:text-6xl font-bold mb-6">Objev svůj další zážitek.</h1>
                    <p className="text-xl md:text-2xl mb-8 text-secondary">
                        Vyber si, co chceš zažít. My ti pomůžeme sestavit výlet včetně trasy, zastávek a časového plánu.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <Link to="/wizard" className="bg-accent text-primary-dark px-8 py-4 rounded-full font-bold text-lg hover:bg-yellow-400 transition shadow-lg transform hover:-translate-y-1">
                            Naplánovat výlet
                        </Link>
                        <button className="bg-transparent border-2 border-white px-8 py-4 rounded-full font-bold text-lg hover:bg-white hover:text-primary-dark transition shadow-lg">
                            Překvap mě
                        </button>
                    </div>
                </div>
                {/* Organický tvar (vlna) naspodu */}
                <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none">
                    <svg className="relative block w-full h-[100px]" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
                        <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V120H0V95.8C52.16,106.12,105.21,114.7,159.25,114.7,214.5,114.7,268.5,93.22,321.39,56.44Z" fill="#FFFFFF"></path>
                    </svg>
                </div>
            </section>

            {/* Další sekce */}
            <section className="py-20 px-4">
                <div className="container mx-auto">
                    <h2 className="text-3xl font-bold text-primary-dark mb-12 text-center">Jak to funguje</h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="bg-secondary p-8 rounded-3xl text-center shadow-sm">
                            <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">1</div>
                            <h3 className="text-xl font-bold mb-4 text-primary-dark">Zadej své preference</h3>
                            <p className="text-primary-dark opacity-80">Vyber si čas, místo a co tě baví. Vše podle tvé nálady.</p>
                        </div>
                        <div className="bg-secondary p-8 rounded-3xl text-center shadow-sm">
                            <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">2</div>
                            <h3 className="text-xl font-bold mb-4 text-primary-dark">Aplikace naplánuje trasu</h3>
                            <p className="text-primary-dark opacity-80">Náš inteligentní algoritmus sestaví logický itinerář.</p>
                        </div>
                        <div className="bg-secondary p-8 rounded-3xl text-center shadow-sm">
                            <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6">3</div>
                            <h3 className="text-xl font-bold mb-4 text-primary-dark">Vyraz za zážitky</h3>
                            <p className="text-primary-dark opacity-80">Užij si bezstarostný výlet s interaktivní mapou v mobilu.</p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}
FILE

cat << 'FILE' > pages/Wizard.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Location } from '../types/api';
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
        <div className="container mx-auto py-12 px-4 max-w-3xl">
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
FILE

cat << 'FILE' > pages/Result.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlanResponse } from '../types/api';
import { generatePlan } from '../services/apiClient';

export default function Result() {
    const [result, setResult] = useState<PlanResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const reqStr = sessionStorage.getItem('planRequest');
        if (reqStr) {
            const req = JSON.parse(reqStr);
            generatePlan(req)
                .then(setResult)
                .catch(err => setError(err.message))
                .finally(() => setLoading(false));
        } else {
            setError('Žádná data k plánování.');
            setLoading(false);
        }
    }, []);

    if (loading) {
        return <div className="flex justify-center items-center h-64 text-primary text-xl">Generuji ideální výlet...</div>;
    }

    if (error) {
        return (
            <div className="container mx-auto py-12 px-4 text-center">
                <div className="bg-red-100 text-red-700 p-6 rounded-xl max-w-lg mx-auto mb-6">
                    <p>Chyba: {error}</p>
                    <p className="text-sm mt-2">Backend pravděpodobně není dostupný. Zkontrolujte docker kontejnery.</p>
                </div>
                <Link to="/wizard" className="text-primary underline">Zkusit znovu</Link>
            </div>
        );
    }

    if (!result) return null;

    return (
        <div className="container mx-auto py-12 px-4">
            <div className="flex flex-col lg:flex-row gap-8">
                {/* Itinerář */}
                <div className="lg:w-1/2">
                    <h1 className="text-3xl font-bold text-primary-dark mb-6">Tvůj plánovaný výlet: {result.location}</h1>
                    <div className="bg-secondary p-4 rounded-xl mb-8 flex justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Celkový čas</p>
                            <p className="font-bold text-primary-dark">{result.total_planned_time} min</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Volný čas zbylo</p>
                            <p className="font-bold text-primary-dark">{result.remaining_free_time_mins} min</p>
                        </div>
                    </div>

                    <div className="relative border-l-2 border-primary ml-4 pl-8 space-y-8">
                        {result.itinerary.map((item, idx) => (
                            <div key={idx} className="relative">
                                {/* Tečka na ose */}
                                <div className="absolute -left-[41px] top-1 w-6 h-6 bg-white border-4 border-primary rounded-full"></div>
                                
                                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                                    <div className="flex justify-between mb-2">
                                        <span className="font-bold text-primary-dark">{item.start} - {item.end}</span>
                                        <span className="text-sm bg-secondary text-primary-dark px-2 py-1 rounded">{item.duration_mins} min</span>
                                    </div>
                                    
                                    {item.type === 'travel' || item.type === 'travel_return' ? (
                                        <div>
                                            <p className="text-gray-600">Přesun ({item.mode}) - {item.distance_km} km</p>
                                        </div>
                                    ) : (
                                        <div>
                                            <h3 className="text-xl font-bold text-primary-dark">{item.title}</h3>
                                            <p className="text-sm text-gray-500 mb-2">{item.category}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Mapa (Placeholder) */}
                <div className="lg:w-1/2">
                    <div className="sticky top-6 bg-gray-200 rounded-3xl h-[600px] flex items-center justify-center overflow-hidden relative">
                        <div className="absolute inset-0 bg-[url('https://maps.wikimedia.org/osm-intl/12/2199/1400.png')] bg-cover bg-center opacity-50"></div>
                        <div className="relative z-10 bg-white p-6 rounded-xl shadow-lg text-center max-w-sm">
                            <h3 className="font-bold text-primary-dark mb-2">Interaktivní mapa</h3>
                            <p className="text-sm text-gray-600 mb-4">Pro plnou funkčnost mapy je nutné integrovat Leaflet nebo Google Maps API.</p>
                            <div className="text-left text-xs bg-gray-50 p-3 rounded">
                                <p className="font-bold mb-1">Cíle na trase:</p>
                                <ul className="list-disc pl-4">
                                    {result.waypoints.map((wp, i) => (
                                        <li key={i}>{wp.name}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
FILE


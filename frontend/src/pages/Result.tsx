import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PlanResponse } from '../types/api';
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
            <div className="container mx-auto pt-28 pb-12 px-4 text-center">
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
        <div className="container mx-auto pt-28 pb-12 px-4">
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

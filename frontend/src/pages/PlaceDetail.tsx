import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { PlaceDetail as PlaceDetailType } from '../types/api';
import { fetchPlace } from '../services/apiClient';
import { ArrowLeft, MapPin } from 'lucide-react';
import { CATEGORY_COLORS, CATEGORY_LABELS, DIFFICULTY_LABELS, MONTHS } from '../constants';
import { CategoryTag } from '../components/Icons';
import PlaceImage from '../components/PlaceImage';
import { applePlaceNavUrl, googlePlaceNavUrl, mapyPlaceNavUrl } from '../utils/navigation';

function SmallMap({ lat, lng, color }: { lat: number; lng: number; color: string }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!ref.current) return;
        const map = L.map(ref.current, { scrollWheelZoom: false }).setView([lat, lng], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);
        L.circleMarker([lat, lng], { radius: 10, color: '#fff', weight: 3, fillColor: color, fillOpacity: 1 }).addTo(map);
        return () => { map.remove(); };
    }, [lat, lng, color]);
    return <div ref={ref} className="w-full h-full" />;
}

function hoursLabel(p: PlaceDetailType) {
    if (!p.open_time || !p.close_time) return 'neuvedeno';
    if (p.open_time === '00:00' && p.close_time === '23:59') return 'nonstop';
    if (p.open_time === '06:00' && p.close_time === '22:00') return 'volně přístupné (přes den)';
    return `${p.open_time} – ${p.close_time} (odhad, ověřte na webu)`;
}

export default function PlaceDetail() {
    const { id } = useParams();
    const [place, setPlace] = useState<PlaceDetailType | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchPlace(Number(id)).then(setPlace).catch(err => setError(err.message));
    }, [id]);

    if (error) {
        return (
            <div className="container mx-auto pt-28 pb-12 px-4 text-center">
                <p className="bg-red-100 text-red-700 p-6 rounded-xl max-w-lg mx-auto mb-6">{error}</p>
                <Link to="/mapa" className="text-primary underline">Zpět na mapu</Link>
            </div>
        );
    }
    if (!place) return <div className="flex justify-center items-center h-64 pt-28 text-primary text-xl">Načítám místo…</div>;

    const facts: [string, string][] = [
        ['Vstupné', place.price ? `cca ${Math.round(place.price)} Kč` : 'zdarma'],
        ['Otevřeno', hoursLabel(place)],
        ['Sezóna', place.season_from && place.season_to ? `${MONTHS[place.season_from - 1]} – ${MONTHS[place.season_to - 1]}` : 'celoročně'],
        ['Délka návštěvy', place.est_duration_mins ? `cca ${place.est_duration_mins} min` : '–'],
        ['Typ', place.indoor ? 'uvnitř – vhodné i za deště' : 'venku'],
        ['Náročnost', DIFFICULTY_LABELS[place.difficulty] ?? place.difficulty],
    ];

    return (
        <div className="container mx-auto pt-28 pb-12 px-4 max-w-5xl">
            <Link to="/mapa" className="inline-flex items-center gap-1 text-primary font-semibold"><ArrowLeft size={18} aria-hidden="true" /> Mapa míst</Link>

            <div className="mt-4 rounded-3xl overflow-hidden shadow-lg">
                {/* Bez fotky jen nízký barevný pruh - velká plocha s ikonou působila jako chyba */}
                <PlaceImage src={place.image_url} alt={place.name} category={place.category}
                    className={place.image_url ? 'w-full h-64 md:h-96' : 'w-full h-28 md:h-32'} />
            </div>

            <div className="flex flex-col lg:flex-row gap-8 mt-8">
                <div className="lg:w-2/3">
                    <p className="text-gray-500"><CategoryTag category={place.category} label={CATEGORY_LABELS[place.category]} /></p>
                    <h1 className="text-3xl md:text-4xl font-bold text-primary-dark mt-1 mb-4">{place.name}</h1>
                    {place.address && <p className="text-gray-600 mb-4 flex items-start gap-1.5"><MapPin size={18} className="text-primary mt-0.5 shrink-0" aria-hidden="true" /> {place.address}</p>}
                    {place.description && <p className="text-lg text-gray-700 leading-relaxed mb-6">{place.description}</p>}

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                        {facts.map(([label, value]) => (
                            <div key={label} className="bg-secondary rounded-2xl p-4">
                                <p className="text-sm text-gray-600">{label}</p>
                                <p className="font-semibold text-primary-dark">{value}</p>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-wrap gap-4 items-center">
                        <Link to={`/wizard?location=${place.nearest_location.id}`}
                            className="bg-accent text-primary-dark px-8 py-4 rounded-full font-bold hover:bg-yellow-400 transition shadow-md">
                            Naplánovat výlet odsud
                        </Link>
                        {place.website && (
                            <a href={place.website} target="_blank" rel="noopener noreferrer" className="text-primary font-semibold underline">Web místa</a>
                        )}
                    </div>
                    <p className="text-sm text-gray-500 mt-2">Start v obci {place.nearest_location.name} ({place.nearest_location.distance_km} km od místa).</p>

                    {place.source && (
                        <p className="mt-8 pt-4 border-t border-gray-100 text-sm text-gray-500">
                            Zdroj:{' '}
                            {place.source.url
                                ? <a href={place.source.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">{place.source.name}</a>
                                : place.source.name}
                            {place.source.license ? ` (${place.source.license})` : ''}
                        </p>
                    )}
                </div>

                <div className="lg:w-1/3">
                    <div className="rounded-3xl overflow-hidden shadow-lg border border-secondary h-72 relative z-0">
                        <SmallMap lat={place.lat} lng={place.lng} color={CATEGORY_COLORS[place.category]} />
                    </div>
                    <p className="text-center text-sm text-gray-500 mt-3">Navigovat sem:</p>
                    <div className="flex justify-center flex-wrap gap-x-4 gap-y-1 mt-1 text-sm">
                        <a href={googlePlaceNavUrl(place.lat, place.lng)} target="_blank" rel="noopener noreferrer" className="text-primary font-semibold underline">Google Maps</a>
                        <a href={mapyPlaceNavUrl(place.lat, place.lng)} target="_blank" rel="noopener noreferrer" className="text-primary font-semibold underline">Mapy.cz</a>
                        <a href={applePlaceNavUrl(place.lat, place.lng)} target="_blank" rel="noopener noreferrer" className="text-primary font-semibold underline">Apple Mapy</a>
                    </div>
                </div>
            </div>
        </div>
    );
}

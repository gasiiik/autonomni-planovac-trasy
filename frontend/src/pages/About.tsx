import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DatasetsResponse } from '../types/api';
import { RefreshCw } from 'lucide-react';
import { fetchDatasets } from '../services/apiClient';

const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function About() {
    const [data, setData] = useState<DatasetsResponse | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchDatasets().then(setData).catch(err => setError(err.message));
    }, []);

    const maxUsed = Math.max(1, ...(data?.datasets ?? []).map(d => d.places_used ?? 0));

    return (
        <div className="container mx-auto pt-28 pb-12 px-4 max-w-4xl">
            <h1 className="text-3xl md:text-4xl font-bold text-primary-dark mb-4">O datech</h1>
            <p className="text-lg text-gray-700 mb-8">
                KrušnoPlán staví výlety z otevřených dat Karlovarského kraje, která zveřejňuje{' '}
                <a href="https://www.datazapad.cz/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Katalog otevřených dat DataZápad</a>.
                Data automaticky stahujeme, vyřazujeme nepřístupná místa, slučujeme duplicity mezi sadami a z textových
                údajů odvozujeme otevírací dobu, sezónu a vstupné, se kterými pak počítá plánovač.
            </p>

            {error && <p className="bg-red-100 text-red-700 p-4 rounded-xl mb-6">{error}</p>}

            {data && (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                        <div className="bg-secondary p-5 rounded-2xl">
                            <p className="text-sm text-gray-600">Míst z DataZápadu</p>
                            <p className="text-3xl font-bold text-primary-dark">{data.places_from_datazapad}</p>
                            {data.places_manual > 0 && <p className="text-xs text-gray-500 mt-1">+ {data.places_manual} ručně doplněných</p>}
                        </div>
                        <div className="bg-secondary p-5 rounded-2xl">
                            <p className="text-sm text-gray-600">Datových sad</p>
                            <p className="text-3xl font-bold text-primary-dark">{data.datasets.length}</p>
                        </div>
                        <div className="bg-secondary p-5 rounded-2xl">
                            <p className="text-sm text-gray-600">Poslední aktualizace</p>
                            <p className="text-lg font-bold text-primary-dark">{data.last_import ? formatDate(data.last_import) : '–'}</p>
                            {data.import_running && <p className="text-xs text-primary mt-1 flex items-center gap-1"><RefreshCw size={12} className="animate-spin" aria-hidden="true" /> Právě probíhá aktualizace dat…</p>}
                        </div>
                    </div>

                    {data.datasets.length === 0 ? (
                        <p className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl">
                            {data.import_running
                                ? 'Data se právě poprvé stahují z DataZápadu, za pár minut je tu uvidíte.'
                                : 'Data zatím nebyla naimportována.'}
                        </p>
                    ) : (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-secondary text-primary-dark">
                                    <tr>
                                        <th className="p-3">Datová sada</th>
                                        <th className="p-3 w-1/3">Použitá místa</th>
                                        <th className="p-3 whitespace-nowrap">Licence</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.datasets.map(d => (
                                        <tr key={d.title} className="border-t border-gray-100">
                                            <td className="p-3">
                                                {d.url ? (
                                                    <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">{d.title}</a>
                                                ) : d.title}
                                            </td>
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-2 rounded-full bg-primary" style={{ width: `${((d.places_used ?? 0) / maxUsed) * 100}%`, minWidth: '2px' }} />
                                                    <span className="whitespace-nowrap text-gray-700" title="použito / záznamů v sadě">
                                                        {d.places_used ?? 0} / {d.records_total ?? '?'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-3 whitespace-nowrap">{d.license ?? '–'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <p className="text-xs text-gray-500 mt-3">
                        Použito / záznamů v sadě: rozdíl tvoří veřejnosti nepřístupná místa, celoplošné položky (např. celé město)
                        a místa uvedená ve více sadách, která počítáme jen jednou.
                    </p>
                </>
            )}

            <h2 className="text-2xl font-bold text-primary-dark mt-12 mb-4">Další zdroje</h2>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Předpověď počasí: <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Open-Meteo</a> (CC BY 4.0)</li>
                <li>Fotky míst: <a href="https://cs.wikipedia.org/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Wikipedie</a> a <a href="https://commons.wikimedia.org/" target="_blank" rel="noopener noreferrer" className="text-primary underline">Wikimedia Commons</a> – přiřazujeme je jen při shodě názvu a polohy. Když tam fotka není, použijeme náhledový obrázek z oficiálního webu místa uvedeného v DataZápadu (patří provozovateli webu, zdroj je uveden přímo u fotky).</li>
                <li>Mapa: © přispěvatelé <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="text-primary underline">OpenStreetMap</a></li>
            </ul>

            <div className="mt-12">
                <Link to="/wizard" className="bg-accent text-primary-dark px-8 py-4 rounded-full font-bold hover:bg-yellow-400 transition shadow-md">
                    Naplánovat výlet
                </Link>
            </div>
        </div>
    );
}

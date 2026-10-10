// Ilustrační fotky podle typu místa - pro místa bez vlastní fotky a restaurace z OpenStreetMap.
// Volné licence z Wikimedia Commons, uložené ve webu (public/images/ilustrace). U fotky je vždy "Ilustrační foto" a autor.
import type { Category } from '../types/api';

export interface Illustration { src: string; author: string; license: string; source: string }

const PHOTOS: Record<string, Omit<Illustration, 'src'>> = {
    kone: {"author": "MartinVeselka", "license": "CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Horn%C3%AD_Du%C5%A1nice_-_pastvina_na_v%C3%BDchodn%C3%ADm_okraji_osady_Rezek,_pod_Exkurzn%C3%AD_cestou.jpg"},
    farma: {"author": "ŠJů", "license": "CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:Kozy_u_Mil%C3%AD%C4%8Dova.jpg"},
    koupaliste: {"author": "Czeva", "license": "CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:Krom%C4%9B%C5%99%C3%AD%C5%BE,_koupali%C5%A1t%C4%9B_Bajda_01.jpg"},
    bazen: {"author": "KeepActive Australia from Melbourne, VIC, Australia", "license": "CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Public_Swimming_Pool_in_Melbourne_VIC_Australia.jpg"},
    solna: {"author": "Saltium", "license": "CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Halotherapy_Spain_.jpg"},
    hvezdarna: {"author": "Sokoljan", "license": "CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:Ond%C5%99ejov_Astron_Observ_DSCN0564.JPG"},
    restaurace: {"author": "Kawon Kez Sel", "license": "CC0", "source": "https://commons.wikimedia.org/wiki/File:Prague,_U_Medv%C3%ADdk%C5%AF_restaurant,_Oldgott_beer.jpg"},
    zricenina: {"author": "ferrywolfis", "license": "CC BY 3.0", "source": "https://commons.wikimedia.org/wiki/File:And%C4%9Blsk%C3%A1_Hora_-_panoramio.jpg"},
    motyli: {"author": "Ryan Somma", "license": "CC BY 2.0", "source": "https://commons.wikimedia.org/wiki/File:Tropical_Butterfly_House.jpg"},
    lanovy: {"author": "Frank Vincentz", "license": "CC BY-SA 3.0", "source": "https://commons.wikimedia.org/wiki/File:Malta_-_Attard_-_Ta%27_Qali_BOV_Adventure_Park_-_High_Ropes_Course_02_ies.jpg"},
    bludiste: {"author": "Mister No", "license": "CC BY 3.0", "source": "https://commons.wikimedia.org/wiki/File:Zrcadlov%C3%A9_bludi%C5%A1t%C4%9B_na_Pet%C5%99%C3%ADn%C4%9B_-_panoramio.jpg"},
    muzeum: {"author": "Biswarup Ganguly", "license": "CC BY 3.0", "source": "https://commons.wikimedia.org/wiki/File:Indian_Buddhist_Art_Exhibition_-_Indian_Museum_-_Kolkata_2012-12-21_2236.JPG"},
    kavarna: {"author": "Bahnfrend", "license": "CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Caf%C3%A9_Mozart,_2019_(01).jpg"},
    trampolina: {"author": "DrSmartypants4", "license": "CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:Trampoline_in_Euroupe.jpg"},
};

// Typ podle názvu místa (pořadí = priorita), jídlo bez rozpoznaného typu = restaurace
const RULES: [string, RegExp][] = [
    ['kone', /\bkon[eiu]\b|jezdec|\bstaj|\branc|kocik|hipo/],
    ['farma', /\bfarm(a|y|e|ou)?\b|statek|dvur|zvirec/],
    ['solna', /soln|salt|salin/],
    ['motyli', /motyl/],
    ['bludiste', /bludist|labyrint/],
    ['trampolina', /trampol/],
    ['hvezdarna', /hvezdar|observ/],
    ['koupaliste', /koupalist/],
    ['bazen', /bazen|plavec|aqua/],
    ['lanovy', /lanov/],
    ['kavarna', /kavar|cafe|coffee|cukrar|kafe/],
    ['muzeum', /muze|galeri|expozic|museum/],
    ['zricenina', /zricenin|pozustat/],
];

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function illustrationFor(name: string, category?: Category): Illustration | null {
    const n = plain(name);
    const key = RULES.find(([, re]) => re.test(n))?.[0] ?? (category === 'GASTRO' ? 'restaurace' : null);
    return key ? { src: `/images/ilustrace/${key}.jpg`, ...PHOTOS[key] } : null;
}

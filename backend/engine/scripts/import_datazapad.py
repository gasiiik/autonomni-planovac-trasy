"""
Import turistických cílů z DataZápad (Open Data Karlovarského kraje).

Zdroj: https://www.datazapad.cz  ->  ArcGIS Feature Services organizace rWPztfBz4QnSDpfD
Každá vrstva (zámky, hrady, muzea, rozhledny, prameny, pivovary, ...) se stáhne přes ArcGIS REST API
(/FeatureServer/<layer>/query, souřadnice ve WGS84), převede se na ActivityPOI a uloží do DB.

- Import je opakovatelný: záznamy se párují podle external_id ("<služba>:<OBJECTID>"), takže
  další spuštění data jen aktualizuje (žádné duplicity).
- Obce, které ještě nemáme v tabulce locations, se automaticky založí.
- Fotky: DataZápad je neobsahuje, proto se dohledávají na Wikipedii/Commons - ale JEN pokud článek
  opravdu odpovídá danému místu (shoda názvu + vzdálenost). Když tam nejsou, použije se náhledový
  obrázek (og:image) z oficiálního webu místa uvedeného v DataZápadu, případně první velká fotka
  na té stránce (bez log, ikon, erbů a plakátů). Před weby mají přednost fotky z Wikidat.
  Jinak frontend zobrazí ikonu kategorie (lepší žádná fotka než špatná fotka).

- Z dat se čte přístupnost (nepřístupné objekty vypadnou, zavřené zámky jsou jen "zastávka zvenku"),
  vstupné, otevírací doba, sezóna (lanová centra, rozhledny, koupaliště), adresa a popis.
- Jedno místo ve více vrstvách (NKP + náboženské památky...) se uloží jen jednou.
- Záznamy, které z DataZápad zmizely nebo nově nevyhoví filtrům, se z DB smažou.

Spuštění (v kontejneru):  docker exec backend-python_engine-1 python scripts/import_datazapad.py
    --no-images   bez dohledávání fotek (rychlé, dříve nalezené fotky zůstanou)
    --dry-run     jen vypíše, co by se importovalo, do DB nesahá
    --refresh-images  znovu dohledá i fotky, které už místa mají
"""
import os
import sys
import json
import math
import re
import unicodedata
import time
import collections
import urllib.error
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Přidáme parent složku do cesty, abychom mohli importovat z app/
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.models import Location, ActivityPOI, Dataset

# URL databáze (přečte z prostředí nebo použije výchozí pro lokální spuštění)
DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://api_user:api_password@localhost:3306/krusnoplan")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

ARCGIS_BASE = "https://services-eu1.arcgis.com/rWPztfBz4QnSDpfD/arcgis/rest/services/"
# Wikimedia vyžaduje v User-Agent kontakt (URL/e-mail), jinak vrací HTTP 429 na každý dotaz
USER_AGENT = "KrusnoPlan/1.0 (https://github.com/gasiiik/autonomni-planovac-trasy; SOC projekt - planovac tras)"

# Konfigurace vrstev DataZápad -> naše kategorie a odhady pro plánovač
#   duration = průměrná délka návštěvy (min), price = odhad vstupného (Kč), pokud je placené
#   open/close = typická otevírací doba (DataZápad ji strojově neuvádí)
LAYERS = [
    # --- Památky / Sightseeing ---
    {"service": "Zámky_v_Karlovarském_kraji_WFL1", "category": "SIGHTSEEING", "duration": 90, "price": 150, "indoor": 1, "open": "09:00", "close": "17:00", "tags": "ZAMEK", "kind": "Zámek"},
    {"service": "Hrady__tvrze_a_zříceniny_v_Karlovarském_kraji_WFL1", "category": "SIGHTSEEING", "duration": 60, "price": 120, "indoor": 0, "open": "09:00", "close": "18:00", "tags": "HRAD", "kind": "Hrad"},
    {"service": "Muzea_a_galerie_v_KVK_WFL1", "category": "SIGHTSEEING", "duration": 60, "price": 100, "indoor": 1, "open": "10:00", "close": "17:00", "tags": "MUZEUM"},
    {"service": "Muzea_v_přírodě_a_skanzeny_v_KVK_WFL1", "category": "SIGHTSEEING", "duration": 75, "price": 80, "indoor": 0, "open": "09:00", "close": "17:00", "tags": "SKANZEN"},
    {"service": "Národní_kulturní_památky_v_KVK_WFL1", "category": "SIGHTSEEING", "duration": 45, "price": 0, "indoor": 0, "open": "00:00", "close": "23:59", "tags": "NKP"},
    {"service": "UNESCO_v_Karlovarském_kraji_WFL1", "category": "SIGHTSEEING", "duration": 60, "price": 0, "indoor": 0, "open": "00:00", "close": "23:59", "tags": "UNESCO"},
    {"service": "Náboženské_památky_v_Karlovarském_kraji_WFL1", "category": "SIGHTSEEING", "duration": 30, "price": 0, "indoor": 1, "open": "09:00", "close": "18:00", "tags": "KOSTEL"},
    {"service": "Technické_památky_v_KVK_WFL1", "category": "SIGHTSEEING", "duration": 45, "price": 0, "indoor": 0, "open": "00:00", "close": "23:59", "tags": "TECHNIKA"},
    {"service": "Přístupné_prameny_v_KK_WFL1", "category": "SIGHTSEEING", "duration": 15, "price": 0, "indoor": 0, "open": "06:00", "close": "22:00", "tags": "PRAMEN"},
    {"service": "Rozhledny_v_Karlovarském_kraji_WFL1", "category": "SIGHTSEEING", "duration": 45, "price": 50, "indoor": 0, "open": "09:00", "close": "18:00", "tags": "ROZHLEDNA", "difficulty": "MEDIUM"},
    {"service": "Jiné_atraktivity_v_Karlovarském_kraji_WFL1", "category": "SIGHTSEEING", "duration": 45, "price": 0, "indoor": 0, "open": "09:00", "close": "18:00", "tags": "ATRAKCE"},
    # --- Zábava / rodina ---
    {"service": "ZOO_a_zooparky_v_Karlovarském_kraji_WFL1", "category": "FUN", "duration": 120, "price": 150, "indoor": 0, "open": "09:00", "close": "17:00", "tags": "ZOO"},
    {"service": "Lanová_a_zábavní_centra_v_KVK_WFL1", "category": "FUN", "duration": 90, "price": 250, "indoor": 0, "open": "10:00", "close": "18:00", "tags": "LANOVKA", "difficulty": "MEDIUM"},
    {"service": "Aquaparky__koupaliště_a_bazény_v_Karlovarském_kraji_WFL1", "category": "FUN", "duration": 120, "price": 200, "indoor": 1, "open": "09:00", "close": "21:00", "tags": "AQUAPARK"},
    {"service": "Solné_jeskyně_v_Karlovarském_kraji_WFL1", "category": "FUN", "duration": 50, "price": 150, "indoor": 1, "open": "10:00", "close": "19:00", "tags": "WELLNESS", "kind": "Solná jeskyně"},
    {"service": "Agroturistické_destinace_v_KVK_WFL1", "category": "FUN", "duration": 75, "price": 0, "indoor": 0, "open": "09:00", "close": "17:00", "tags": "FARMA"},
    # --- Příroda ---
    {"service": "Přírodní_pozoruhodnosti_v_KVK_WFL1", "category": "PARK", "duration": 60, "price": 0, "indoor": 0, "open": "00:00", "close": "23:59", "tags": "PRIRODA", "difficulty": "MEDIUM"},
    {"service": "Botanické_zahrady_a_arboreta_v_Karlovarském_kraji_WFL1", "category": "PARK", "duration": 60, "price": 60, "indoor": 0, "open": "09:00", "close": "18:00", "tags": "ZAHRADA"},
    # --- Sport a volný čas (další datové sady DataZápad) ---
    {"service": "Lyžařské_vleky_v_Karlovarském_kraji_WFL1", "category": "FUN", "duration": 180, "price": 600, "indoor": 0, "open": "09:00", "close": "16:00", "tags": "LYZOVANI", "kind": "Lyžařský areál", "difficulty": "MEDIUM",
     "default_season": (12, 3), "all_year_if": r"letní|mimo zimní"},
    {"service": "Golfová_hřiště_v_Karlovarském_kraji_WFL1", "category": "FUN", "duration": 180, "price": 1500, "indoor": 0, "open": "08:00", "close": "19:00", "tags": "GOLF", "kind": "Golfové hřiště", "difficulty": "MEDIUM", "family": 0,
     "default_season": (4, 10)},
    {"service": "Jezdecké_oddíly_a_kluby_v_Karlovarském_kraji_WFL1", "category": "FUN", "duration": 90, "price": 400, "indoor": 0, "open": "09:00", "close": "17:00", "tags": "JEZDECTVI", "kind": "Jezdecký areál",
     "require": r"vyjížď|projížď|výcvik jezdců|výuk|kurz|hipoterap|pro veřejnost|jízd[ay] na koni|turist"},
    {"service": "Vojenské_a_pietní_památky_v_KVK_WFL1", "category": "SIGHTSEEING", "duration": 20, "price": 0, "indoor": 0, "open": "06:00", "close": "22:00", "tags": "PIETNI"},
    # --- Gastro ---
    {"service": "Pivovarnictví_v_Karlovarském_kraji_WFL1", "category": "GASTRO", "duration": 60, "price": 200, "indoor": 1, "open": "11:00", "close": "22:00", "tags": "PIVOVAR,RESTAURACE", "family": 1, "kind": "Pivovar"},
]

# Klíče, které začínají "název_", ale NEJSOU názvem objektu
_NAME_EXCLUDE = ("obce", "okres", "ulice", "vyšší", "kraj", "části", "katastr", "provozovatel", "organizace", "správce", "momc")


def http_json(url, timeout=30, retries=4):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            # Wikipedie při rychlém dotazování vrací 429 -> počkáme a zkusíme znovu
            if e.code not in (429, 503) or attempt == retries - 1:
                raise
            time.sleep(float(e.headers.get("Retry-After") or 2 ** attempt))


def haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def normalize(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9 ]", " ", s)


_STOPWORDS = {"v", "u", "na", "nad", "pod", "a", "sv", "svateho", "svate", "kostel", "hrad", "zamek", "muzeum",
              "rozhledna", "pramen", "karlovy", "vary", "kraj", "karlovarsky", "cheb", "the", "de", "z", "ze", "do"}


def tokens(s):
    return {t for t in normalize(s).split() if len(t) > 2 and t not in _STOPWORDS}


# ---------------------------------------------------------------------------
# 1) Stažení dat z DataZápad
# ---------------------------------------------------------------------------
def clean(v):
    """Normalizuje hodnotu atributu na čistý text (None pro prázdné hodnoty)."""
    if v is None:
        return None
    s = re.sub(r"\s+", " ", str(v).replace("\xa0", " ")).strip()
    return s or None


def lower_attrs(attrs):
    """Datasety mají nejednotnou velikost písmen v názvech polí (Název / název) -> sjednotíme."""
    return {k.lower().strip(): clean(v) for k, v in attrs.items()}


def first(a, *keys):
    """Vrátí první vyplněnou hodnotu podle pořadí klíčů (pořadí = priorita)."""
    for k in keys:
        if a.get(k):
            return a[k]
    return None


def extract_name(a):
    if a.get("název"):
        return a["název"]
    for k, v in a.items():
        if k.startswith("název_") and v and not any(x in k for x in _NAME_EXCLUDE):
            return v
    return None


def extract_website(a):
    # "jiná_webová_stránka" u pramenů bývá oficiální web města, "webová_stránka_estudanky" je katalog
    site = first(a, "webová_stránka", "jiná_webová_stránka") or next(
        (v for k, v in a.items() if "webov" in k and v), None)
    return site[:255] if site else None


def extract_address(a):
    if a.get("adresa_solné_jeskyně") or a.get("adresa_místa"):
        return (a.get("adresa_solné_jeskyně") or a["adresa_místa"])[:255]
    obec = a.get("název_obce")
    ulice = first(a, "název_ulice", "ulice")
    cp = first(a, "číslo_domovní", "číšlo_domovní")
    co = a.get("číslo_orientační")
    cislo = f"{cp}/{co}" if cp and co else cp
    psc = a.get("poštovní_směrovací_číslo")
    street = " ".join(x for x in (ulice, cislo) if x) if ulice and ulice != obec else (f"č.p. {cislo}" if cislo else None)
    town = " ".join(x for x in (f"{psc[:3]} {psc[3:]}" if psc and len(psc) == 5 else psc, obec) if x)
    addr = ", ".join(x for x in (street, town) if x)
    return addr[:255] or None


def is_true(v):
    return str(v).strip().lower() in ("true", "1", "ano", "yes")


def is_false(v):
    return str(v).strip().lower() in ("false", "0", "ne", "no")


def geometry_to_latlng(geom):
    if not geom:
        return None, None
    if "x" in geom and "y" in geom:
        return geom["y"], geom["x"]
    rings = geom.get("rings") or geom.get("paths")
    if rings and rings[0]:
        pts = rings[0]
        return sum(p[1] for p in pts) / len(pts), sum(p[0] for p in pts) / len(pts)
    return None, None


def fetch_layer(cfg):
    svc_url = ARCGIS_BASE + urllib.parse.quote(cfg["service"]) + "/FeatureServer"
    meta = http_json(svc_url + "?f=json")
    layers = meta.get("layers", [])
    if not layers:
        return []
    layer_id = layers[0]["id"]

    features, offset = [], 0
    while True:
        q = (f"{svc_url}/{layer_id}/query?where=1%3D1&outFields=*&outSR=4326&f=json"
             f"&resultOffset={offset}&resultRecordCount=1000")
        data = http_json(q)
        batch = data.get("features", [])
        features.extend(batch)
        if not data.get("exceededTransferLimit") or not batch:
            break
        offset += len(batch)
    return features


def fetch_dataset_meta(cfg):
    """Název, odkaz na datazapad.cz a licence datové sady (z položky ArcGIS Online, ze které DataZápad čerpá)."""
    svc_url = ARCGIS_BASE + urllib.parse.quote(cfg["service"]) + "/FeatureServer"
    item_id = http_json(svc_url + "?f=json").get("serviceItemId")
    meta = {"service": cfg["service"], "item_id": item_id, "title": layer_label(cfg), "url": None, "license": None}
    if item_id:
        item = http_json(f"https://www.arcgis.com/sharing/rest/content/items/{item_id}?f=json")
        lic = (item.get("licenseInfo") or "")
        meta["title"] = item.get("title") or meta["title"]
        meta["url"] = f"https://www.datazapad.cz/datasets/{item_id}"
        meta["license"] = "CC0 1.0" if "CC0" in lic else ("CC BY 4.0" if ("CC BY 4.0" in lic or "by/4.0" in lic) else None)
    return meta


# --- Přístupnost ------------------------------------------------------------
OPEN, EXTERIOR, CLOSED = "OPEN", "EXTERIOR", "CLOSED"

# Textová pole, která v různých vrstvách popisují přístup / provoz / vstup
_ACCESS_KEYS = ("přístupné", "přístupnost", "přístup", "vstup", "provoz", "poznámka", "poznámka_otevírací_doba")

# Místa, která nejdou naplánovat (jen po domluvě, jen pro hotelové hosty, mimo provoz...)
_RE_UNPLANNABLE = re.compile(
    r"(?<!nejlépe )po (předchozí |telefonické |telefonnické )?(domluvě|dohodě)"
    r"|pouze pro hotelové|mimo provoz|aktuálně zavřen|dle rezervací")
# Objekt je zavřený, ale dá se aspoň prohlédnout zvenku (nádvoří, park, kostel mimo bohoslužby...)
_EXTERIOR_HINTS = ("zvenčí", "exteriér", "nádvoří", "park je", "park volně", "příležitostně", "bohoslužeb",
                   "konání akcí", "kulturních a", "částečně přístupn", "přístupný částečně", "slouží jako hotel",
                   "vstup omezený")


def access_text(a):
    return " | ".join(a[k] for k in _ACCESS_KEYS if a.get(k)).lower()


def access_status(a):
    """OPEN = normálně navštívitelné, EXTERIOR = jen krátká zastávka zvenku, CLOSED = do plánu nepatří."""
    text = access_text(a)
    if _RE_UNPLANNABLE.search(text):
        return CLOSED
    exterior = any(h in text for h in _EXTERIOR_HINTS)
    if is_false(a.get("přístupné")) or "nepřístupn" in text or "dezolátní" in text:
        return EXTERIOR if exterior else CLOSED
    # Částečně přístupné objekty bez běžné prohlídky (sídlo úřadu, hotel...) -> jen zvenku.
    # Hrady se vstupným a "některými exteriéry volně přístupnými" ale zůstávají normální prohlídkou.
    if exterior and not any(w in text for w in ("vstupné", "provozní době", "otevírací")):
        return EXTERIOR
    return OPEN


def is_paid(a):
    """True/False podle dat, None když vrstva o vstupném nic neříká."""
    for k in ("vstupné", "vstupní_poplatek"):
        if is_true(a.get(k)):
            return True
        if is_false(a.get(k)):
            return False
    text = access_text(a)
    if any(w in text for w in ("zpoplatněn", "za poplatek", "placeno vstupné", "(vstupné)")):
        return True
    if any(w in text for w in ("zdarma", "volný", "bezplatn", "dobrovoln")):
        return False
    return None


# --- Otevírací doba a sezóna -----------------------------------------------
DAYLIGHT = ("06:00", "22:00")  # volně přístupná místa venku plánujeme přes den
_RE_HOURS = re.compile(r"(\d{1,2})[:.](\d{2})\s*(?:h\s*)?(?:-|–|do|a)\s*(\d{1,2})[:.](\d{2})")
_MONTHS = [(r"leden|ledna", 1), (r"únor|února", 2), (r"březen|března", 3), (r"duben|dubna", 4),
           (r"květen|května", 5), (r"červenec|července", 7), (r"červen|června", 6), (r"srpen|srpna", 8),
           (r"září", 9), (r"říjen|října", 10), (r"listopad|listopadu", 11), (r"prosinec|prosince", 12)]
_RE_MONTH = re.compile("|".join(f"(?P<m{n}>{p})" for p, n in _MONTHS) + r"|\b\d{1,2}\.\s*(?P<num>\d{1,2})\.(?!\d)")


def parse_hours(text):
    m = _RE_HOURS.search(text)
    if not m:
        return None
    h1, m1, h2, m2 = map(int, m.groups())
    if not (0 <= h1 < 24 and 0 <= h2 < 24 and (h1, m1) < (h2, m2)):
        return None
    return f"{h1:02d}:{m1:02d}", f"{h2:02d}:{m2:02d}"


def parse_season(text):
    """Vrátí (měsíc_od, měsíc_do) z textů typu "duben - říjen", "od 31. 3. do 1. 11.", "od jara do podzimu"."""
    if "mimo hlavní sezónu" in text:  # mimo sezónu má otevřeno aspoň o víkendech -> sezónu neomezujeme
        return None
    months = []
    for m in _RE_MONTH.finditer(text):
        if m.group("num"):
            n = int(m.group("num"))
            if 1 <= n <= 12:
                months.append(n)
        else:
            months.append(next(int(k[1:]) for k, v in m.groupdict().items() if v and k != "num"))
    if len(months) >= 2:
        return months[0], months[1]
    if "od jara do podzimu" in text:
        return 4, 10
    if "letní sezón" in text:
        return 6, 9
    return None


# --- Popis ------------------------------------------------------------------
# Příznaky (true/false), které má smysl uvést v popisu - "Zámek: true" u vrstvy zámků nic neříká
_FLAG_LABELS = {"zřícenina": "zřícenina", "tvrz": "tvrz", "archeologické_stopy": "archeologické stopy",
                "muzeum": "muzeum", "galerie": "galerie", "vyhlídková_věž": "vyhlídková věž", "vyhlídka": "vyhlídka",
                "minizoo": "minizoo", "obora": "obora", "aquapark": "aquapark", "bazén": "bazén",
                "koupaliště": "koupaliště", "ekologická_farma": "ekologická farma", "statek": "statek",
                "hipoturistika": "hipoturistika", "botanická_zahrada": "botanická zahrada", "arboretum": "arboretum",
                "minipivovar": "minipivovar"}


def layer_label(cfg):
    return re.sub(r"_WFL1$", "", cfg["service"]).replace("__", ", ").replace("_", " ")


def build_description(cfg, a, status):
    """Popis z DataZápad: pole "Popis", jinak složený z typu, památkové ochrany, poznámky a přístupu."""
    access = first(a, "přístupnost", "přístup", "provoz", "poznámka_otevírací_doba") \
        or (a["vstup"] if a.get("vstup") and a["vstup"] not in ("volný", "zpoplatněný") else None)
    if a.get("přístupné") and not (is_true(a["přístupné"]) or is_false(a["přístupné"])):
        access = access or a["přístupné"]

    parts = []
    popis = first(a, "popis", "stručný_popis")
    if popis and not cfg.get("require"):
        parts.append(popis.rstrip(".") + ".")
    elif popis:
        # Jezdecké kluby mají v popisu jen výčet služeb ("vyjížďky, výcvik...") -> doplníme typ a obec
        place = f" v obci {a['název_obce']}" if a.get("název_obce") else ""
        parts.append(f"{cfg.get('kind', 'Místo')}{place}: {popis.rstrip('.')}.")
    else:
        kind = first(a, "typ", "typ_atraktivity", "typ_centra", "typ_památky")
        flags = [lbl for k, lbl in _FLAG_LABELS.items() if is_true(a.get(k))]
        # Vrstvy bez typu (pivovary, solné jeskyně...) -> obecný typ z konfigurace, ať popis není jen název sady
        if not kind and not flags:
            kind = cfg.get("kind")
        head = ", ".join(x for x in [kind] + flags if x)
        if head and a.get("název_obce"):
            head += f" v obci {a['název_obce']}"
        protection = first(a, "památková_ochrana", "památka")
        if protection and protection.startswith("není"):
            protection = None
        head = ", ".join(x for x in (head, protection) if x)
        if head:
            parts.append(head[0].upper() + head[1:] + ".")
        note = a.get("poznámka")
        if note and note.lower() not in ("vstupné", "kulturní památka") and note != access:
            parts.append(note[0].upper() + note[1:].rstrip(".") + ".")
    if access:
        access = access.rstrip(".")
        parts.append((access[0].upper() + access[1:] if access.lower().startswith("přístup") else "Přístup: " + access) + ".")
    if status == EXTERIOR:
        parts.append("Veřejnosti běžně nepřístupné - v plánu jako krátká zastávka zvenku.")
    if not parts:
        parts.append(f"{layer_label(cfg)}.")
    return " ".join(parts)[:2000]


# --- Převod záznamu ------------------------------------------------------------
# Celoplošné položky (celé město, krajina, geopark) nejsou zastávkou na trase
_SKIP_TYPES = ("lázeňské město", "kulturní krajina", "geopark")
# Upřesnění kategorie u smíšené vrstvy "Jiné atraktivity"
_CATEGORY_BY_TYPE = {"zábavní": "FUN", "motýlí": "FUN", "lanovka": "FUN", "farma": "FUN",
                     "památný strom": "PARK", "naučná stezka": "PARK"}


def feature_to_poi(cfg, feat):
    a = lower_attrs(feat.get("attributes", {}))
    lat, lng = geometry_to_latlng(feat.get("geometry"))
    name = extract_name(a)
    # "pramen bez jména" apod. - beze jména místo v plánu nepomůže
    if not name or lat is None or "bez jména" in name.lower():
        return None

    # Pivovary: přeskočíme "létající pivovary" (nemají vlastní provozovnu k návštěvě)
    if cfg["service"].startswith("Pivovarnictví") and is_true(a.get("létající_pivovar")) \
            and not is_true(a.get("minipivovar")) and not is_true(a.get("pivovar")):
        return None
    kind = (first(a, "typ", "typ_atraktivity", "typ_centra", "typ_památky") or "").lower()
    if any(t in kind for t in _SKIP_TYPES):
        return None

    status = access_status(a)
    if status == CLOSED:
        return None
    # Vrstvy, kde jen část záznamů je pro turisty (jezdecké kluby: vyjížďky ano, jen ustájení koní ne)
    if cfg.get("require") and not re.search(cfg["require"], " ".join(str(v) for v in a.values() if v), re.I):
        return None

    text = access_text(a)
    ruin = is_true(a.get("zřícenina")) or name.lower().startswith(("zřícenina", "zbytky", "pozůstatky", "zaniklý"))
    category = next((c for k, c in _CATEGORY_BY_TYPE.items() if k in kind), cfg["category"])
    duration = cfg["duration"]
    indoor = cfg["indoor"]
    difficulty = cfg.get("difficulty", "EASY")
    open_time, close_time = cfg["open"], cfg["close"]
    tags = [t for t in cfg.get("tags", "").split(",") if t]

    # Vstupné: podle příznaku / textu v datech, jinak odhad z konfigurace vrstvy
    paid = is_paid(a)
    if paid is None and ruin:
        paid = False
    price = cfg["price"] if paid is None else ((cfg["price"] or 100) if paid else 0)

    # Venkovní / vnitřní
    if ruin:
        indoor = 0
        tags.append("ZRICENINA")
    if is_true(a.get("koupaliště")) and not is_true(a.get("bazén")) and not is_true(a.get("aquapark")):
        indoor = 0
        tags.append("KOUPALISTE")
    if is_true(a.get("obora")):
        indoor = 0

    # Otevírací doba: konkrétní časy z textu > volný přístup (přes den) > typická doba pro vrstvu
    hours = parse_hours(text)
    if hours:
        open_time, close_time = hours
    elif paid and (open_time, close_time) == ("00:00", "23:59"):
        # Placená prohlídka (NKP, technické památky) nemá nonstop provoz -> běžná otevírací doba
        open_time, close_time = "09:00", "17:00"
    elif not paid and (ruin or any(w in text for w in ("volně přístupn", "přístup volný", "bez omezení",
                                                          "časově neomezen"))):
        open_time, close_time = DAYLIGHT

    # Sezóna (lanová centra, rozhledny, venkovní koupaliště)
    season = parse_season(text)
    if not season and "KOUPALISTE" in tags:
        season = (6, 8)
    # Výchozí sezóna vrstvy (lyžování v zimě, golf v létě) - pokud záznam neříká, že má provoz celoročně
    if not season and cfg.get("default_season"):
        notes = " ".join(str(v) for v in a.values() if v).lower()
        if not (cfg.get("all_year_if") and re.search(cfg["all_year_if"], notes)):
            season = cfg["default_season"]

    # Prameny v terénu jsou dál od cest
    if a.get("přístupnost") in ("pěšina (pěšky)", "volný terén"):
        difficulty = "MEDIUM"

    if status == EXTERIOR:
        duration, price, indoor = min(duration, 20), 0, 0
        open_time, close_time = DAYLIGHT
        tags.append("ZVENKU")

    obec = a.get("název_obce")
    return {
        "external_id": f"{cfg['service']}:{a.get('objectid')}",
        "name": name[:200],
        "description": build_description(cfg, a, status),
        "category": category,
        "est_duration_mins": duration,
        "lat": float(lat),
        "lng": float(lng),
        "open_time": open_time,
        "close_time": close_time,
        "season_from": season[0] if season else None,
        "season_to": season[1] if season else None,
        "price_estimated": float(price),
        "tags": ",".join(dict.fromkeys(tags)),
        "family_friendly": cfg.get("family", 1),
        "difficulty_level": difficulty,
        "indoor": indoor,
        "website": extract_website(a),
        "address": extract_address(a),
        "obec": obec,
    }


def dedupe(pois):
    """Jedno místo bývá ve více vrstvách (např. klášter Teplá v NKP i v náboženských památkách).
    Necháme první výskyt (pořadí LAYERS), doplníme mu delší popis a sloučíme tagy.
    Název obce se do shody nepočítá ("Krytý bazén Sokolov" není "Zámek Sokolov")."""
    def key_tokens(p):
        return tokens(p["name"]) - tokens(p["obec"] or "")

    kept = []
    for poi in pois:
        toks = key_tokens(poi)
        dup = None
        for k in kept:
            other = key_tokens(k)
            dist = haversine_m(poi["lat"], poi["lng"], k["lat"], k["lng"])
            # Stejný název do 1 km = stejné místo (u "Hrad a zámek Bečov nad Teplou" po odečtení obce
            # a obecných slov nezbude žádné klíčové slovo, takže by ho slovní porovnání nezachytilo)
            same_name = normalize(poi["name"]).split() == normalize(k["name"]).split() and dist < 1000
            similar = toks and other and k["category"] == poi["category"] and dist < 150                 and len(toks & other) / min(len(toks), len(other)) >= 0.5
            if same_name or similar:
                dup = k
                break
        if not dup:
            kept.append(poi)
            continue
        if len(poi["description"]) > len(dup["description"]):
            dup["description"] = poi["description"]
        dup["tags"] = ",".join(dict.fromkeys(t for t in (dup["tags"] + "," + poi["tags"]).split(",") if t))
        dup["website"] = dup["website"] or poi["website"]
        dup["address"] = dup["address"] or poi["address"]
    return kept


# ---------------------------------------------------------------------------
# 2) Fotky z Wikipedie / Wikimedia Commons (jen při jisté shodě)
# ---------------------------------------------------------------------------
WIKI_API = "https://cs.wikipedia.org/w/api.php?action=query&format=json"
COMMONS_API = "https://commons.wikimedia.org/w/api.php?action=query&format=json"


def name_variants(name):
    """"Zřícenina hradu Himlštejn (Himmelstein)" -> plný název i název bez závorky."""
    base = re.sub(r"\s*\(.*?\)", "", name).strip()
    return list(dict.fromkeys(v for v in (name, base) if v))


def wiki_image(poi):
    name_tokens = tokens(poi["name"]) - tokens(poi.get("obec") or "")
    try:
        # a) Přesný název článku (s přesměrováním), článek musí ležet do 1,5 km
        for title in name_variants(poi["name"]):
            url = (WIKI_API + "&redirects=1&prop=pageimages|coordinates&piprop=thumbnail&pithumbsize=600&titles="
                   + urllib.parse.quote(title))
            for page in http_json(url, timeout=10).get("query", {}).get("pages", {}).values():
                thumb = page.get("thumbnail", {}).get("source")
                coords = page.get("coordinates")
                if thumb and coords and haversine_m(poi["lat"], poi["lng"], coords[0]["lat"], coords[0]["lon"]) < 1500:
                    return thumb

        if not name_tokens:
            return None

        # b) Články v okolí 300 m, které sdílí klíčové slovo názvu
        url = (WIKI_API + "&generator=geosearch"
               f"&ggscoord={poi['lat']}|{poi['lng']}&ggsradius=300&ggslimit=10"
               "&prop=pageimages&piprop=thumbnail&pithumbsize=600")
        best = best_match(http_json(url, timeout=10), name_tokens,
                          lambda page: page.get("thumbnail", {}).get("source"))
        if best:
            return best

        # c) Fotky na Wikimedia Commons do 150 m, jejichž název souboru odpovídá místu
        #    (pomáhá u pramenů, rozhleden a menších památek bez vlastního článku)
        url = (COMMONS_API + "&generator=geosearch&ggsnamespace=6"
               f"&ggscoord={poi['lat']}|{poi['lng']}&ggsradius=150&ggslimit=30"
               "&prop=imageinfo&iiprop=url&iiurlwidth=600")
        return best_match(http_json(url, timeout=10), name_tokens,
                          lambda page: (page.get("imageinfo") or [{}])[0].get("thumburl"))
    except Exception:
        return None


_RE_OG_IMAGE = re.compile(
    r'<meta[^>]+(?:property|name)=["\'](?:og:image|twitter:image)(?::url)?["\'][^>]*content=["\']([^"\']+)'
    r'|<meta[^>]+content=["\']([^"\']+)["\'][^>]*(?:property|name)=["\'](?:og:image|twitter:image)(?::url)?["\']', re.I)
# Loga, ikony a vektorové obrázky nejsou fotka místa; odkazy z Facebooku po čase přestanou fungovat
_BAD_IMAGE = re.compile(r"logo|icon|favicon|placeholder|default|fbcdn|pexels|unsplash|shutterstock|pixabay|stock|\.svg|\.ico|\.gif", re.I)
MIN_PHOTO_BYTES = 20000  # menší soubor bývá logo nebo ikona


def website_image(poi):
    """Náhledový obrázek (og:image) z oficiálního webu místa uvedeného v DataZápadu.
    Záložní zdroj, když fotka není na Wikipedii/Commons. Obrázek patří provozovateli webu."""
    site = poi.get("website")
    if not site or not site.startswith("http"):
        return None
    try:
        req = urllib.request.Request(site, headers={"User-Agent": "Mozilla/5.0 " + USER_AGENT})
        with urllib.request.urlopen(req, timeout=8) as resp:
            html = resp.read(400000).decode("utf-8", "ignore")
        m = _RE_OG_IMAGE.search(html)
        if not m:
            return None
        img = urllib.parse.urljoin(site, (m.group(1) or m.group(2)).strip().replace("&amp;", "&"))
        if not img.startswith("http") or _BAD_IMAGE.search(img):
            return None
        # Ověříme, že obrázek existuje a není to malá ikona
        head = urllib.request.Request(img, method="HEAD", headers={"User-Agent": "Mozilla/5.0 " + USER_AGENT})
        with urllib.request.urlopen(head, timeout=8) as resp:
            ctype = resp.headers.get("Content-Type", "")
            size = int(resp.headers.get("Content-Length") or 0)
        if ctype and not ctype.startswith("image/"):
            return None
        if size and size < MIN_PHOTO_BYTES:
            return None
        return img[:2000]
    except Exception:
        return None


# Slova určující typ objektu - blízký objekt z Wikidat bereme, jen když je stejného typu
_TYPE_WORDS = {"muzeum", "galerie", "hrad", "zamek", "zamecek", "kostel", "kaple", "klaster", "rozhledna", "pramen",
               "kyselka", "studanka", "tvrz", "zricenina", "vez", "pivovar", "minipivovar", "synagoga", "mlyn",
               "minimuzeum", "bazilika", "hvezdarna", "skanzen", "kolonada"}


def _words(s):
    return set(normalize(s).split())


def wikidata_image(poi):
    """Fotka (P18) objektu z Wikidat do 300 m od místa. Objekt musí odpovídat názvem, nebo být do 80 m
    a stejného typu (muzeum, hrad...). Samotnou obec ("Abertamy") nebereme - fotka náměstí není fotka muzea."""
    query = f"""SELECT ?label ?image ?dist WHERE {{
      SERVICE wikibase:around {{ ?item wdt:P625 ?loc . bd:serviceParam wikibase:center "Point({poi['lng']} {poi['lat']})"^^geo:wktLiteral .
        bd:serviceParam wikibase:radius "0.3" . bd:serviceParam wikibase:distance ?dist . }}
      ?item wdt:P18 ?image . ?item rdfs:label ?label . FILTER(LANG(?label) = "cs")
    }} ORDER BY ?dist LIMIT 25"""
    try:
        data = http_json("https://query.wikidata.org/sparql?format=json&query=" + urllib.parse.quote(query), timeout=20)
    except Exception:
        return None
    obec = poi.get("obec") or ""
    key = tokens(poi["name"]) - tokens(obec)
    name_words = _words(poi["name"])
    for b in data.get("results", {}).get("bindings", []):
        label, dist = b["label"]["value"], float(b["dist"]["value"]) * 1000
        if normalize(label).strip() == normalize(obec).strip():
            continue  # položka celé obce
        lt = tokens(label) - tokens(obec)
        same_name = key and lt and len(key & lt) / min(len(key), len(lt)) >= 0.5
        label_words = _words(label)
        same_type = dist < 80 and (name_words & label_words & _TYPE_WORDS)
        contained = dist < 80 and label_words and label_words <= name_words  # "Kynžvart" v "Zřícenina hradu Kynžvart"
        if same_name or same_type or contained:
            return b["image"]["value"].replace("http://", "https://") + "?width=800"
    return None


_RE_PAGE_IMG = re.compile(r'<img[^>]+(?:data-src|src)=["\']([^"\']+\.(?:jpe?g|webp)(?:\?[^"\']*)?)["\']', re.I)
# Grafika stránky, ne fotka místa (pozadí, záhlaví, erb obce, plakát, pozvánka...)
_BAD_PAGE_IMG = re.compile(r"banner|header|\bbg\b|bg[-_.]|background|sprite|flag|vlajk|erb|znak|crest|wappen|ikon|"
                           r"pozvank|plakat|poster|letak|flyer|[-_]a[45][-_.]|program|titulka|regioncard|card.|reklam|mapa|plan[-_]", re.I)
# Ručně ověřené špatné shody (fotka sousedního objektu) - název souboru po dekódování URL
_BLOCKED_IMAGES = ("Bečov náměstí úřad",)
# Fotka jiného objektu u konkrétního místa: (část názvu místa, část názvu souboru)
_BLOCKED_PAIRS = (
    ("Kostel svatého Jáchyma", "mincovna"),
    ("Festivalový most", "Lavička_Václava_Havla"),
    ("Muzeum numismatiky", "kostel_sv._Kláry"),
    ("Čertkus", "Podhorní_nádrž"),
    ("Důl Mauritius", "štola_Kryštof"),
    ("Mini zoo Diana", "restaurace Diana"),
    ("Centrum Trampolín", "Aussichtsturm"),
)


def blocked_image(name, url):
    if not url:
        return False
    decoded = urllib.parse.unquote(url)
    return any(b in decoded for b in _BLOCKED_IMAGES) or         any(p in (name or "") and f.lower() in decoded.lower() for p, f in _BLOCKED_PAIRS)
MIN_PAGE_PHOTO_BYTES = 40000


def page_image(poi):
    """První velká fotka (JPG/WebP) na oficiální stránce místa - když web nemá náhledový obrázek."""
    site = poi.get("website")
    if not site or not site.startswith("http"):
        return None
    try:
        req = urllib.request.Request(site, headers={"User-Agent": "Mozilla/5.0 " + USER_AGENT})
        with urllib.request.urlopen(req, timeout=8) as resp:
            html = resp.read(600000).decode("utf-8", "ignore")
    except Exception:
        return None
    for src in _RE_PAGE_IMG.findall(html)[:15]:
        img = urllib.parse.urljoin(site, src.replace("&amp;", "&"))
        if _BAD_IMAGE.search(img) or _BAD_PAGE_IMG.search(img):
            continue
        try:
            head = urllib.request.Request(img, method="HEAD", headers={"User-Agent": "Mozilla/5.0 " + USER_AGENT})
            with urllib.request.urlopen(head, timeout=8) as resp:
                if resp.headers.get("Content-Type", "").startswith("image/") \
                        and int(resp.headers.get("Content-Length") or 0) >= MIN_PAGE_PHOTO_BYTES:
                    return img[:2000]
        except Exception:
            continue
    return None


def find_image(poi):
    """Nejdřív volné licence (Wikipedie, Commons, Wikidata), pak oficiální web místa z DataZápadu."""
    img = wiki_image(poi) or wikidata_image(poi) or website_image(poi) or page_image(poi)
    return None if blocked_image(poi.get("name"), img) else img


def best_match(data, name_tokens, get_thumb):
    """Vybere stránku/soubor, jehož název sdílí aspoň polovinu klíčových slov názvu místa."""
    best, best_score = None, 0.0
    for page in data.get("query", {}).get("pages", {}).values():
        thumb = get_thumb(page)
        if not thumb:
            continue
        title = re.sub(r"^(Soubor|File):|\.(jpe?g|png|gif|tiff?)$", "", page.get("title", ""), flags=re.I)
        overlap = len(name_tokens & tokens(title)) / len(name_tokens)
        if overlap > best_score:
            best, best_score = thumb, overlap
    return best if best_score >= 0.5 else None


# ---------------------------------------------------------------------------
# 3) Uložení do DB
# ---------------------------------------------------------------------------
def ensure_schema():
    """Doplní nové sloupce do již existující DB (MariaDB podporuje ADD COLUMN IF NOT EXISTS)."""
    stmts = [
        "ALTER TABLE activity_pois MODIFY image_url TEXT",
        "ALTER TABLE activity_pois ADD COLUMN IF NOT EXISTS source VARCHAR(30) DEFAULT 'MANUAL'",
        "ALTER TABLE activity_pois ADD COLUMN IF NOT EXISTS external_id VARCHAR(150)",
        "ALTER TABLE activity_pois ADD COLUMN IF NOT EXISTS website VARCHAR(255)",
        "ALTER TABLE activity_pois ADD COLUMN IF NOT EXISTS indoor TINYINT(1) DEFAULT 0",
        "ALTER TABLE activity_pois ADD COLUMN IF NOT EXISTS address VARCHAR(255)",
        "ALTER TABLE activity_pois ADD COLUMN IF NOT EXISTS season_from TINYINT",
        "ALTER TABLE activity_pois ADD COLUMN IF NOT EXISTS season_to TINYINT",
        """CREATE TABLE IF NOT EXISTS datasets (
            service VARCHAR(150) PRIMARY KEY, title VARCHAR(255), item_id VARCHAR(64), url VARCHAR(255),
            license VARCHAR(50), records_total INT, places_used INT, imported_at DATETIME)""",
        "CREATE INDEX IF NOT EXISTS idx_external_id ON activity_pois (external_id)",
    ]
    with engine.begin() as conn:
        for s in stmts:
            conn.execute(text(s))
        # Staré záznamy z dočasného Wikipedia importu nahrazujeme reálnými daty z DataZápad
        removed = conn.execute(text(
            "DELETE FROM activity_pois WHERE description = 'Reálná památka stažená dynamicky z Open Data rozhraní.'"
        )).rowcount
        if removed:
            print(f"🧹 Odstraněno {removed} dočasných záznamů z předchozího Wikipedia importu.")


def resolve_location(db, poi, loc_cache, created):
    obec = poi["obec"]
    if obec:
        key = obec.lower()
        if key in loc_cache:
            return loc_cache[key]
        loc = Location(name=obec, lat=poi["lat"], lng=poi["lng"])
        db.add(loc)
        db.flush()
        loc_cache[key] = loc
        created[key] = loc
        print(f"🏙️  Nová obec z DataZápad: {obec}")
        return loc
    # Bez obce -> nejbližší známá lokalita
    return min(loc_cache.values(), key=lambda l: haversine_m(poi["lat"], poi["lng"], l.lat, l.lng))


def run_import(with_images=True, dry_run=False, refresh_images=False):
    print("⏳ Stahuji turistické cíle z DataZápad (ArcGIS REST API)...")
    pois = []
    fetched_services = set()  # jen u úspěšně stažených vrstev smíme mazat zaniklé záznamy
    datasets = {}
    for cfg in LAYERS:
        try:
            feats = fetch_layer(cfg)
            converted = [p for p in (feature_to_poi(cfg, f) for f in feats) if p]
            pois.extend(converted)
            fetched_services.add(cfg["service"])
            try:
                datasets[cfg["service"]] = dict(fetch_dataset_meta(cfg), records_total=len(feats))
            except Exception as e:
                print(f"   ⚠ {cfg['service']}: metadata datové sady se nepodařilo načíst ({e})")
            print(f"   ✔ {cfg['service']}: {len(converted)} z {len(feats)} míst (zbytek nepřístupný / mimo plán)")
        except Exception as e:
            print(f"   ✖ {cfg['service']}: chyba {e}")
    total = len(pois)
    pois = dedupe(pois)
    print(f"📥 Celkem {len(pois)} míst z DataZápad (sloučeno {total - len(pois)} duplicit mezi vrstvami).")

    if dry_run:
        for p in pois:
            print(f"   {p['category']:<12} {p['price_estimated']:>5.0f} Kč  {p['open_time']}-{p['close_time']}  "
                  f"sezóna {p['season_from'] or '-'}-{p['season_to'] or '-'}  {p['name']}")
        print("🧪 --dry-run: do DB se nic nezapsalo.")
        return

    ensure_schema()
    if with_images:
        # Místa, která fotku už mají, nehledáme znovu (týdenní automatický import je pak rychlý)
        known = {}
        if not refresh_images:
            with engine.connect() as conn:
                known = dict(conn.execute(text(
                    "SELECT external_id, image_url FROM activity_pois WHERE source = 'DATAZAPAD' AND image_url <> ''")).all())
        missing = [p for p in pois if not known.get(p["external_id"])]
        for p in pois:
            p["image_url"] = known.get(p["external_id"])
        print(f"🖼️  Dohledávám fotky pro {len(missing)} míst (Wikipedie, Commons, oficiální web místa)...")
        with ThreadPoolExecutor(max_workers=2) as pool:  # víc vláken = HTTP 429 od Wikipedie
            for poi, img in zip(missing, pool.map(find_image, missing)):
                poi["image_url"] = img
        # Stejná fotka z webu u více míst = obecná fotka řetězce/firmy, ne fotka konkrétního místa
        web_counts = collections.Counter(p["image_url"] for p in pois if p.get("image_url") and "wikimedia" not in p["image_url"])
        for p in pois:
            if p.get("image_url") and web_counts.get(p["image_url"], 0) > 1:
                p["image_url"] = None
        print(f"   ✔ Fotku má {sum(1 for p in pois if p.get('image_url'))} z {len(pois)} míst.")

    db = SessionLocal()
    try:
        loc_cache = {l.name.lower(): l for l in db.query(Location).all()}
        manual = db.query(ActivityPOI).filter((ActivityPOI.source == None) | (ActivityPOI.source != "DATAZAPAD")).all()  # noqa: E711
        existing = {p.external_id: p for p in db.query(ActivityPOI).filter(ActivityPOI.source == "DATAZAPAD").all()}

        added = updated = skipped = 0
        created = {}
        used_per_service = {}
        donor_images = {}  # fotka ze shodného místa v DataZápadu pro ruční záznam bez fotky
        for poi in pois:
            # Duplicita s ručně zadaným místem (např. "Hrad Loket") -> ruční záznam má přednost
            twin = next((m for m in manual if haversine_m(poi["lat"], poi["lng"], m.lat, m.lng) < 120
                         and (tokens(poi["name"]) & tokens(m.name))), None)
            if twin:
                if poi.get("image_url"):
                    donor_images.setdefault(twin.id, poi["image_url"])
                skipped += 1
                continue
            svc = poi["external_id"].split(":")[0]
            used_per_service[svc] = used_per_service.get(svc, 0) + 1

            loc = resolve_location(db, poi, loc_cache, created)
            fields = {k: v for k, v in poi.items() if k not in ("obec", "image_url")}
            fields["location_id"] = loc.id
            fields["source"] = "DATAZAPAD"
            row = existing.get(poi["external_id"])
            # Fotku přepíšeme jen novým nálezem (výpadek Wikipedie nesmaže dříve nalezené fotky)
            if with_images and (poi.get("image_url") or not row):
                fields["image_url"] = poi.get("image_url")
            if row and blocked_image(row.name, row.image_url):
                fields["image_url"] = None   # dříve přiřazená špatná fotka

            if row:
                for k, v in fields.items():
                    setattr(row, k, v)
                updated += 1
            else:
                db.add(ActivityPOI(**fields))
                added += 1

        # Ručně zadaná místa měla ilustrační fotky (picsum/unsplash), ne fotky těch míst -> skutečná fotka, nebo žádná
        if with_images:
            placeholders = [m for m in manual if m.image_url and re.search(r"picsum\.photos|unsplash\.com", m.image_url)]
            for m in placeholders:
                loc_name = next((l.name for l in loc_cache.values() if l.id == m.location_id), None)
                m.image_url = find_image({"name": m.name, "lat": m.lat, "lng": m.lng, "obec": loc_name, "website": m.website})                     or donor_images.get(m.id)
            if placeholders:
                print(f"   ✔ Ilustrační fotky u ručních míst nahrazeny: {sum(1 for m in placeholders if m.image_url)} z {len(placeholders)}")

        # Záznamy, které z DataZápad zmizely nebo je nově vyřazujeme (nepřístupné, duplicity) -> smazat
        imported = {p["external_id"] for p in pois}
        removed = 0
        for ext_id, row in existing.items():
            if ext_id not in imported and ext_id.split(":")[0] in fetched_services:
                db.delete(row)
                removed += 1

        # Nově založené obce: střed = průměr souřadnic jejich míst
        for key, loc in created.items():
            pts = [(p["lat"], p["lng"]) for p in pois if p["obec"] and p["obec"].lower() == key]
            loc.lat = sum(p[0] for p in pts) / len(pts)
            loc.lng = sum(p[1] for p in pts) / len(pts)

        # Metadata datových sad (zdroj u míst + počítadlo dat na úvodní stránce)
        imported_at = datetime.now(ZoneInfo("Europe/Prague")).replace(tzinfo=None)
        for svc, meta in datasets.items():
            db.merge(Dataset(**meta, places_used=used_per_service.get(svc, 0), imported_at=imported_at))

        db.commit()
        print(f"🎉 Hotovo: přidáno {added}, aktualizováno {updated}, smazáno {removed}, "
              f"přeskočeno duplicit s ručními záznamy {skipped}, nových obcí {len(created)}.")
    finally:
        db.close()


if __name__ == "__main__":
    run_import(with_images="--no-images" not in sys.argv, dry_run="--dry-run" in sys.argv,
               refresh_images="--refresh-images" in sys.argv)

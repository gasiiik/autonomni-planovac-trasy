from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Literal, Optional
import math
from datetime import datetime, timedelta
from types import SimpleNamespace
from zoneinfo import ZoneInfo
import urllib.request
import json

from .database import get_db
from .models import Location, ActivityPOI, Dataset, Accommodation
from . import auto_import

@asynccontextmanager
async def lifespan(app: FastAPI):
    auto_import.start() # při startu doplní / obnoví data z DataZápad (na pozadí)
    yield

app = FastAPI(title="KrušnoPlán Python Engine - Pokročilé Trasování", lifespan=lifespan)

# Kontejner běží v UTC, uživatelé plánují v českém čase
LOCAL_TZ = ZoneInfo("Europe/Prague")

# Nejdéle kolik minut jsme ochotni čekat před místem na otevření
MAX_WAIT_MINS = 60

# Max. počet míst stejného typu v jednom plánu (jinak by v Karlových Varech vyšlo 11 pramenů za sebou)
MAX_SAME_TYPE = 3

def poi_type(poi) -> str:
    # Typ místa = první tag (ZAMEK, PRAMEN, MUZEUM...), u ručních záznamů bez tagu kategorie
    return (poi.tags or "").split(",")[0].strip().upper() or poi.category

class PlanRequest(BaseModel):
    location_id: Optional[int] = None  # výchozí obec, nebo start_lat/start_lng (aktuální poloha uživatele)
    start_lat: Optional[float] = None
    start_lng: Optional[float] = None
    start_name: Optional[str] = None
    time_from: str # formát "YYYY-MM-DD HH:MM:SS" (co je teď)
    time_to: str   # formát "YYYY-MM-DD HH:MM:SS" (do kdy má čas)
    transport_mode: Literal["WALK", "BIKE", "CAR"]
    route_type: Literal["ONE_WAY", "LOOP"]
    interests: List[str] # kategorie míst: SIGHTSEEING, PARK, FUN, GASTRO, RUNNING, FESTIVAL

    # NOVÉ PARAMETRY PRO SOČ:
    max_travel_time_mins: Optional[int] = None
    budget_max: Optional[float] = None
    willing_to_pay_entry: Optional[bool] = True
    food_preferences: Optional[List[str]] = []
    difficulty: Optional[str] = "EASY"
    participants_count: Optional[int] = 1
    has_children: Optional[bool] = False
    exclude_ids: Optional[List[int]] = []  # místa navštívená v předchozích dnech dovolené
    area_location_ids: Optional[List[int]] = []  # dovolená: hledat i v okolí dalších obcí (automaticky přidané okolí)
    day_town_ids: Optional[List[int]] = []       # dovolená: další obce, kterými výlet ten den vede (čas dne se rozdělí)
    indoor_when_rain: Optional[bool] = False # při dešti jen místa uvnitř (volba uživatele)

def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def calc_travel_time(dist_km: float, mode: str) -> int:
    # Zde by v produkci bylo volání Google Maps Distance Matrix API
    # Pro účely backendu simulujeme průměrné rychlosti.
    speeds = {"WALK": 5.0, "BIKE": 15.0, "CAR": 40.0}
    spd = speeds.get(mode.upper(), 5.0)
    return math.ceil((dist_km / spd) * 60)

# Okruh "obce" při výletu přes víc měst - čas dne se dělí mezi místa v těchto okruzích
TOWN_RADIUS_KM = 3.0

# Dosah hledání míst od výchozího bodu podle způsobu dopravy (km)
SEARCH_RADIUS_KM = {"WALK": 3.0, "BIKE": 15.0, "CAR": 40.0}

def in_season(poi, day: datetime) -> bool:
    if not poi.season_from or not poi.season_to:
        return True
    if poi.season_from <= poi.season_to:
        return poi.season_from <= day.month <= poi.season_to
    return day.month >= poi.season_from or day.month <= poi.season_to  # sezóna přes Nový rok

def get_weather_info(lat: float, lng: float, t_from: datetime, t_to: datetime):
    """Hodinová předpověď z Open-Meteo pro plánovaný den.
    Vrací (stav, {hodina: {"code": WMO kód, "temp": °C}}) - stav je BAD_WEATHER, když prší většinu plánovaného času."""
    try:
        day = t_from.strftime("%Y-%m-%d")
        url = (f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lng}"
               f"&hourly=weathercode,temperature_2m&timezone=Europe%2FPrague&start_date={day}&end_date={day}")
        req = urllib.request.Request(url, headers={'User-Agent': 'KrusnoPlan/1.0'})
        response = urllib.request.urlopen(req, timeout=3)
        data = json.loads(response.read().decode('utf-8'))

        hourly = data.get("hourly", {})
        forecast = {}
        for t, code, temp in zip(hourly.get("time", []), hourly.get("weathercode", []), hourly.get("temperature_2m", [])):
            if code is not None:
                forecast[datetime.fromisoformat(t).hour] = {"code": code, "temp": round(temp) if temp is not None else None}
        window = [w["code"] for h, w in forecast.items() if t_from.hour <= h <= t_to.hour]
        if not window:
            return "UNKNOWN", forecast
        # WMO Kódy: 50+ znamená déšť, sníh, bouřky. Špatné počasí = prší většinu plánovaného času.
        bad_hours = sum(1 for c in window if c >= 50)
        return ("BAD_WEATHER" if bad_hours * 2 >= len(window) else "GOOD_WEATHER"), forecast
    except Exception:
        return "UNKNOWN", {}

@app.get("/internal/locations")
def get_locations(db: Session = Depends(get_db)):
    return db.query(Location).all()

@app.get("/internal/datasets")
def get_datasets(db: Session = Depends(get_db)):
    """Přehled použitých datových sad z DataZápad pro stránku "O datech"."""
    try:
        datasets = db.query(Dataset).order_by(Dataset.places_used.desc()).all()
    except Exception:
        db.rollback()
        datasets = [] # tabulka ještě neexistuje (první start, import běží)
    manual = db.query(ActivityPOI).filter(ActivityPOI.source != "DATAZAPAD").count()
    return {
        "datasets": [{
            "title": d.title, "url": d.url, "license": d.license,
            "records_total": d.records_total, "places_used": d.places_used,
        } for d in datasets],
        "places_from_datazapad": sum(d.places_used or 0 for d in datasets),
        "places_manual": manual,
        "last_import": max((d.imported_at for d in datasets if d.imported_at), default=None),
        "import_running": auto_import.state["running"],
    }

def poi_summary(p, sources):
    return {
        "id": p.id, "name": p.name, "category": p.category, "lat": p.lat, "lng": p.lng,
        "image_url": p.image_url, "price": p.price_estimated or 0, "indoor": bool(p.indoor),
        "family_friendly": bool(p.family_friendly), "difficulty": p.difficulty_level,
        "tags": [t for t in (p.tags or "").split(",") if t],
        "source": sources.get((p.external_id or "").split(":")[0]) if p.source == "DATAZAPAD" else None,
    }

@app.get("/internal/places")
def get_places(db: Session = Depends(get_db)):
    """Všechna místa pro mapu (bez dlouhých popisů)."""
    sources = dataset_sources(db)
    return [poi_summary(p, sources) for p in db.query(ActivityPOI).order_by(ActivityPOI.name).all()]

@app.get("/internal/places/{poi_id}")
def get_place(poi_id: int, db: Session = Depends(get_db)):
    p = db.query(ActivityPOI).filter(ActivityPOI.id == poi_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Místo nenalezeno.")
    # Nejbližší obec, ze které jde naplánovat výlet "odsud"
    nearest = min(db.query(Location).all(), key=lambda l: haversine_distance(p.lat, p.lng, l.lat, l.lng))
    return {
        **poi_summary(p, dataset_sources(db)),
        "description": p.description, "address": p.address, "website": p.website,
        "open_time": p.open_time, "close_time": p.close_time,
        "season_from": p.season_from, "season_to": p.season_to,
        "est_duration_mins": p.est_duration_mins,
        "nearest_location": {"id": nearest.id, "name": nearest.name,
                             "distance_km": round(haversine_distance(p.lat, p.lng, nearest.lat, nearest.lng), 1)},
    }

ACCOMMODATION_KINDS = {
    "hotel": "Hotel", "guest_house": "Penzion", "apartment": "Apartmán", "chalet": "Chata",
    "hostel": "Hostel", "motel": "Motel", "camp_site": "Kemp",
}

@app.get("/internal/accommodation")
def get_accommodation(lat: float, lng: float, limit: int = 6, radius_km: float = 8.0, db: Session = Depends(get_db)):
    """Nejbližší ubytování k místu (OpenStreetMap). Přednost mají ta s webem a hvězdičkami."""
    try:
        stays = db.query(Accommodation).all()
    except Exception:
        db.rollback()
        return []
    near = [(haversine_distance(lat, lng, a.lat, a.lng), a) for a in stays]
    near = [(d, a) for d, a in near if d <= radius_km]
    # Řazení: vzdálenost, ale ubytování s webem/hvězdičkami (snáz se rezervuje) mírně dopředu
    near.sort(key=lambda da: da[0] - (0.4 if da[1].website else 0) - 0.1 * (da[1].stars or 0))
    return [{
        "id": a.id, "name": a.name, "kind": a.kind, "kind_label": ACCOMMODATION_KINDS.get(a.kind, "Ubytování"),
        "lat": a.lat, "lng": a.lng, "stars": a.stars, "website": a.website, "phone": a.phone,
        "address": a.address, "distance_km": round(d, 1),
    } for d, a in near[:max(1, min(limit, 20))]]

def dataset_sources(db: Session) -> dict:
    """external_id prefix (ArcGIS služba) -> uvedení zdroje u místa"""
    try:
        return {d.service: {"name": f"DataZápad – {d.title}", "url": d.url, "license": d.license}
                for d in db.query(Dataset).all()}
    except Exception:
        db.rollback()
        return {}

@app.post("/internal/planner/generate")
def generate_plan(req: PlanRequest, db: Session = Depends(get_db)):
    try:
        t_from = datetime.strptime(req.time_from, "%Y-%m-%d %H:%M:%S")
        t_to = datetime.strptime(req.time_to, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        raise HTTPException(status_code=400, detail="Čas musí být ve formátu 'YYYY-MM-DD HH:MM:SS'.")

    # Validace: Nelze plánovat do minulosti (porovnáváme v českém čase, ne v UTC kontejneru).
    # Tolerance 5 minut: odjezd "teď" zadaný na minuty je o pár sekund starší, než když dorazí požadavek.
    now = datetime.now(LOCAL_TZ).replace(tzinfo=None)
    if t_from.date() < now.date():
        raise HTTPException(status_code=400, detail="Nelze plánovat trasu na datum v minulosti.")
    if t_from < now - timedelta(minutes=5):
        raise HTTPException(status_code=400, detail="Nelze plánovat trasu na čas, který již dnes proběhl.")

    total_mins = int((t_to - t_from).total_seconds() / 60)

    if total_mins <= 0:
        raise HTTPException(status_code=400, detail="Čas 'do' musí být větší než čas 'od'.")

    # Start: aktuální poloha uživatele, nebo vybraná obec
    if req.start_lat is not None and req.start_lng is not None:
        loc = SimpleNamespace(id=None, name=req.start_name or "Vaše poloha", lat=req.start_lat, lng=req.start_lng)
    else:
        loc = db.query(Location).filter(Location.id == req.location_id).first() if req.location_id else None
        if not loc:
            raise HTTPException(status_code=404, detail="Lokace nenalezena.")

    # Filtrujeme aktivity podle vybraných preferencí a dosahu podle způsobu dopravy
    # (pěšky jen centrum, autem i hrady a rozhledny v okolí)
    radius_km = SEARCH_RADIUS_KM.get(req.transport_mode.upper(), 3.0)
    candidates = db.query(ActivityPOI).filter(ActivityPOI.category.in_(req.interests)).all()
    # Jen podle skutečné vzdálenosti - obec může mít katastr přes 6 km (pěšky by to byl nesmysl)
    excluded = set(req.exclude_ids or [])
    # Okolí startu + okolí dalších obcí dne (dovolená: výlet přes víc měst)
    def town_centers(ids):
        found = {l.id: (l.lat, l.lng) for l in db.query(Location).filter(Location.id.in_(ids)).all()} if ids else {}
        return [found[i] for i in ids if i in found]  # v pořadí, jak je uživatel vybral
    day_towns = [(loc.lat, loc.lng)] + town_centers(req.day_town_ids or [])
    centers = day_towns + town_centers(req.area_location_ids or [])
    pois = [p for p in candidates
            if p.id not in excluded and any(haversine_distance(c[0], c[1], p.lat, p.lng) <= radius_km for c in centers)]
    # Sezónní místa (lanová centra, koupaliště, rozhledny) mimo sezónu vyřadíme
    out_of_season = [p for p in pois if not in_season(p, t_from)]
    pois = [p for p in pois if in_season(p, t_from)]

    # 1. Zohlednění počasí
    weather_status, forecast = get_weather_info(loc.lat, loc.lng, t_from, t_to)
    weather_message = "Počasí je ideální pro jakékoliv aktivity."
    if weather_status == "UNKNOWN":
        weather_message = "Předpověď počasí se nepodařilo načíst, plánujeme bez ohledu na počasí."

    if weather_status == "BAD_WEATHER" and not req.indoor_when_rain:
        # Uživatel si vybírá sám - plán neměníme, jen upozorníme (místa uvnitř frontend označí)
        weather_message = "Podle předpovědi bude pršet – vezměte si deštník. Místa uvnitř jsou v plánu označená."
    elif weather_status == "BAD_WEATHER":
        weather_message = "Podle předpovědi bude pršet, plán jsme proto zaměřili na místa uvnitř."
        # Vyfiltrujeme venkovní aktivity (příznak indoor z DataZápad), pokud máme z čeho jiného vybírat
        indoor_pois = [p for p in pois if p.indoor or p.category == "GASTRO"]
        # Jen restaurace by nebyl výlet -> potřebujeme aspoň jednu vnitřní aktivitu
        if any(p.category != "GASTRO" for p in indoor_pois):
            pois = indoor_pois
        else:
            weather_message = "Podle předpovědi bude pršet, ale pro zvolené preference nemáme místa uvnitř – vezměte si deštník!"

    sources = dataset_sources(db)

    # Klonování listu POI pro algoritmus "Nejbližší soused" (Nearest Neighbor)
    unvisited = pois[:]

    current_time = t_from
    remaining_mins = total_mins

    start_lat, start_lng = loc.lat, loc.lng
    curr_lat, curr_lng = start_lat, start_lng

    waypoints_for_map = [{"lat": start_lat, "lng": start_lng, "name": loc.name, "type": "START"}]
    itinerary = []
    total_estimated_cost = 0.0 # NOVÉ
    total_travel_time = 0 # NOVÉ pro limit cestování
    skip_reasons = set() # Důvody, proč byla místa vyřazena (pro srozumitelnou hlášku)
    last_category = None
    had_lunch = False
    last_meal_end = None # konec posledního jídla - další gastro zastávka nejdřív za 3 hodiny
    type_counts = {} # kolik míst daného typu už v plánu je

    while unvisited:
        # Najdi nejbližší památku k aktuální poloze
        closest_poi = None
        min_dist = float('inf')
        feasible = [] # (vzdálenost, POI) - místa, která splňují všechny podmínky
        next_departure = None # nejbližší čas odjezdu, kdy by se dalo stihnout otevření dosud zavřeného místa

        for p in unvisited:
            # 1b. Rozmanitost - stejného typu nejvýš MAX_SAME_TYPE míst
            if p.category != "GASTRO" and type_counts.get(poi_type(p), 0) >= MAX_SAME_TYPE:
                continue

            # 2. Zohlednění otevírací doby (Opening Hours)
            dist = haversine_distance(curr_lat, curr_lng, p.lat, p.lng)
            travel_approx = calc_travel_time(dist, req.transport_mode)
            arrival_time = current_time + timedelta(minutes=travel_approx)
            wait = 0
            try:
                oh_h, oh_m = map(int, p.open_time.split(':'))
                ct_h, ct_m = map(int, p.close_time.split(':'))
                open_dt = arrival_time.replace(hour=oh_h, minute=oh_m, second=0, microsecond=0)
                close_dt = arrival_time.replace(hour=ct_h, minute=ct_m, second=0, microsecond=0)

                # Přijedeme chvíli před otevřením -> počkáme (max. MAX_WAIT_MINS), jinak místo zatím vynecháme
                if arrival_time < open_dt:
                    wait = math.ceil((open_dt - arrival_time).total_seconds() / 60)
                    if wait > MAX_WAIT_MINS:
                        skip_reasons.add("otevírací doba")
                        depart = open_dt - timedelta(minutes=travel_approx)
                        if next_departure is None or depart < next_departure:
                            next_departure = depart
                        continue
                # Prohlídku musíme stihnout před zavíračkou
                if arrival_time + timedelta(minutes=wait + p.est_duration_mins) > close_dt:
                    skip_reasons.add("otevírací doba")
                    continue
            except (AttributeError, ValueError):
                pass # Pokud chybí data otevírací doby (např. park), ignorujeme a necháme projít

            # 3. Zohlednění nových SOČ parametrů
            price = p.price_estimated or 0
            # a) Peníze
            if not req.willing_to_pay_entry and price > 0:
                skip_reasons.add("placené vstupné")
                continue
            if req.budget_max is not None and (total_estimated_cost + price) > req.budget_max:
                skip_reasons.add("rozpočet")
                continue

            # b) Děti a obtížnost
            if req.has_children and not p.family_friendly:
                skip_reasons.add("nevhodné pro děti")
                continue
            if req.difficulty == "EASY" and p.difficulty_level in ["HARD", "MEDIUM"]:
                skip_reasons.add("obtížnost")
                continue
            if req.difficulty == "MEDIUM" and p.difficulty_level == "HARD":
                skip_reasons.add("obtížnost")
                continue

            # c) Gastronomie (Food preferences)
            if p.category == "GASTRO" and req.food_preferences:
                # Očekáváme, že v p.tags bude čárkou oddělený seznam, např. "CAFE,VEGETARIAN"
                poi_tags = [t.strip().upper() for t in p.tags.split(",")] if p.tags else []
                # Chceme, aby se alespoň jedna z preferencí shodovala (nebo všechny, zvolíme alespoň jednu)
                if not any(pref.upper() in poi_tags for pref in req.food_preferences):
                    skip_reasons.add("preference jídla")
                    continue

            # Řadíme podle toho, za jak dlouho můžeme s návštěvou začít (cesta + případné čekání)
            feasible.append((travel_approx + wait, dist, p, wait))

        # Výlet přes víc měst: čas dne rozdělíme mezi obce (dopoledne první, odpoledne druhá...)
        if len(day_towns) > 1 and feasible:
            part = int((current_time - t_from).total_seconds() / 60 / max(total_mins, 1) * len(day_towns))
            cx = day_towns[min(part, len(day_towns) - 1)]
            # "V obci" = do 3 km od jejího středu (dosah auta 40 km by zahrnul i sousední města)
            in_town = [fp for fp in feasible if haversine_distance(cx[0], cx[1], fp[2].lat, fp[2].lng) <= min(radius_km, TOWN_RADIUS_KM)]
            if in_town:
                feasible = in_town

        # 5. Chytrý výběr místo čistého "nejbližšího":
        #    a) mezi 11:30 a 14:00 upřednostníme oběd (pokud uživatel chce Gastro)
        #    b) dvě gastro zastávky nikdy neplánujeme hned po sobě a další jídlo nejdřív za 3 hodiny
        if last_meal_end and current_time - last_meal_end < timedelta(hours=3):
            feasible = [fp for fp in feasible if fp[2].category != "GASTRO"]
        wait_mins = 0
        if feasible:
            lunch_window = current_time.replace(hour=11, minute=30) <= current_time <= current_time.replace(hour=14, minute=0)
            gastro = [fp for fp in feasible if fp[2].category == "GASTRO"]
            other = [fp for fp in feasible if fp[2].category != "GASTRO"]
            if lunch_window and not had_lunch and gastro:
                pool = gastro
            elif last_category == "GASTRO" and other:
                pool = other
            elif not had_lunch and other and gastro and current_time.hour < 11:
                pool = other  # gastro si necháme na oběd
            else:
                pool = feasible
            _, min_dist, closest_poi, wait_mins = min(pool, key=lambda fp: fp[0])

        # Teď nic otevřeného není (např. odjezd v noci) -> volno do otevření prvních míst a zkusíme znovu
        if closest_poi is None and next_departure and current_time < next_departure < t_to:
            idle = math.ceil((next_departure - current_time).total_seconds() / 60)
            itinerary.append({
                "type": "wait",
                "start": current_time.strftime("%H:%M"),
                "end": next_departure.strftime("%H:%M"),
                "title": f"Volno do otevření prvních míst ({next_departure:%H:%M})",
                "duration_mins": idle
            })
            current_time = next_departure
            remaining_mins -= idle
            continue

        # Pokud už není žádná památka otevřená, ukončíme hledání
        if closest_poi is None:
            break

        poi = closest_poi
        unvisited.remove(poi)

        dist_km = min_dist
        travel_time = calc_travel_time(dist_km, req.transport_mode)

        # 4. Limit na cestování
        if req.max_travel_time_mins is not None and (total_travel_time + travel_time) > req.max_travel_time_mins:
            # Toto místo je moc daleko - zkusíme další (vybraný bod nemusí být nejbližší ze všech, např. oběd)
            skip_reasons.add("limit času na cestě")
            continue

        # Pokud je to OKRUH, musíme si nechat rezervu na návrat
        return_time = 0
        if req.route_type.upper() == "LOOP":
            return_dist = haversine_distance(poi.lat, poi.lng, start_lat, start_lng)
            return_time = calc_travel_time(return_dist, req.transport_mode)

        total_time_needed = travel_time + wait_mins + poi.est_duration_mins + return_time

        if remaining_mins < total_time_needed:
            skip_reasons.add("nedostatek času")
        else:
            # Přidáme cestu tam
            if travel_time > 0:
                itinerary.append({
                    "type": "travel",
                    "start": current_time.strftime("%H:%M"),
                    "end": (current_time + timedelta(minutes=travel_time)).strftime("%H:%M"),
                    "mode": req.transport_mode,
                    "distance_km": round(dist_km, 2),
                    "duration_mins": travel_time
                })
                current_time += timedelta(minutes=travel_time)
                remaining_mins -= travel_time
                total_travel_time += travel_time

            # Čekání na otevření
            if wait_mins > 0:
                itinerary.append({
                    "type": "wait",
                    "start": current_time.strftime("%H:%M"),
                    "end": (current_time + timedelta(minutes=wait_mins)).strftime("%H:%M"),
                    "title": f"Čekání na otevření ({poi.open_time})",
                    "duration_mins": wait_mins
                })
                current_time += timedelta(minutes=wait_mins)
                remaining_mins -= wait_mins

            # Přidáme samotnou aktivitu/památku
            itinerary.append({
                "type": "poi",
                "start": current_time.strftime("%H:%M"),
                "end": (current_time + timedelta(minutes=poi.est_duration_mins)).strftime("%H:%M"),
                "title": poi.name,
                "category": poi.category,
                "duration_mins": poi.est_duration_mins,
                "lat": poi.lat,
                "lng": poi.lng,
                "image_url": poi.image_url,
                "address": poi.address,
                "website": poi.website,
                "description": poi.description,
                "source": sources.get((poi.external_id or "").split(":")[0]) if poi.source == "DATAZAPAD" else None,
                "weather": forecast.get(current_time.hour), # předpověď na začátek návštěvy
                "poi_id": poi.id,
                "indoor": bool(poi.indoor),
                "estimated_cost": poi.price_estimated or 0 # NOVÉ
            })
            total_estimated_cost += poi.price_estimated or 0 # NOVÉ

            waypoints_for_map.append({"lat": poi.lat, "lng": poi.lng, "name": poi.name, "type": "POI"})

            current_time += timedelta(minutes=poi.est_duration_mins)
            remaining_mins -= poi.est_duration_mins
            last_category = poi.category
            type_counts[poi_type(poi)] = type_counts.get(poi_type(poi), 0) + 1
            if poi.category == "GASTRO":
                had_lunch = True
                last_meal_end = current_time
            curr_lat, curr_lng = poi.lat, poi.lng

    # Návrat do startovního bodu, pokud je zvolen LOOP
    if req.route_type.upper() == "LOOP" and (curr_lat != start_lat or curr_lng != start_lng):
        final_dist = haversine_distance(curr_lat, curr_lng, start_lat, start_lng)
        final_travel = calc_travel_time(final_dist, req.transport_mode)

        itinerary.append({
            "type": "travel_return",
            "start": current_time.strftime("%H:%M"),
            "end": (current_time + timedelta(minutes=final_travel)).strftime("%H:%M"),
            "mode": req.transport_mode,
            "title": "Návrat do výchozího bodu",
            "distance_km": round(final_dist, 2),
            "duration_mins": final_travel
        })
        current_time += timedelta(minutes=final_travel)
        remaining_mins -= final_travel
        waypoints_for_map.append({"lat": start_lat, "lng": start_lng, "name": "Cíl - Návrat", "type": "END_LOOP"})

    # Srozumitelné vysvětlení, proč nevznikla žádná trasa
    empty_reason = None
    if not any(i["type"] == "poi" for i in itinerary):
        if not pois and out_of_season:
            empty_reason = f"Místa pro zvolené preference v okolí {loc.name} mají v tomto měsíci zavřeno (mimo sezónu)."
        elif not pois and loc.id is None:
            empty_reason = ("V dosahu vaší polohy nemáme žádná místa pro zvolené preference. KrušnoPlán plánuje výlety "
                            "po Karlovarském kraji - zkuste jiné kategorie, auto, nebo vyberte výchozí obec.")
        elif not pois:
            empty_reason = f"V lokaci {loc.name} zatím nemáme žádná místa pro zvolené preference. Zkuste vybrat jiné kategorie (např. Památky)."
        elif skip_reasons:
            empty_reason = "Žádné místo nevyhovělo podmínkám: " + ", ".join(sorted(skip_reasons)) + "."
        else:
            empty_reason = "Žádné místo se nevešlo do zvoleného časového okna."

    return {
        "status": "success",
        "empty_reason": empty_reason,
        "message": weather_message,
        "weather_status": weather_status,
        "location": loc.name,
        "route_type": req.route_type,
        "transport_mode": req.transport_mode,
        "waypoints": waypoints_for_map,
        "itinerary": itinerary,
        "remaining_free_time_mins": remaining_mins,
        "total_planned_time": total_mins - remaining_mins,
        "total_estimated_cost": total_estimated_cost # NOVÉ
    }

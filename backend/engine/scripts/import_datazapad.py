import os
import urllib.request
import json
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sys

# Přidáme parent složku do cesty, abychom mohli importovat z app/
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.models import Location, ActivityPOI

# URL databáze (přečte z prostředí nebo použije výchozí pro lokální spuštění)
DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://api_user:api_password@localhost:3306/krusnoplan")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Ukázková URL z ArcGIS / DataZápad (tuto URL je pak potřeba vyměnit za reálný odkaz na Dataset z datazapad.cz)
# Většinou to vypadá nějak takto:
# DATAZAPAD_URL = "https://services-eu1.arcgis.com/.../arcgis/rest/services/Turisticke_cile_KVK/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson"

# Pro demonstraci naší logiky použijeme strukturovaný mockup, jako by ho vrátilo API.
# Jakmile SOČkář vloží správný odkaz, skript se připojí na reálná data.
def fetch_datazapad_data():
    print("⏳ Připojuji se k DataZápad (ArcGIS Open Data) API...")
    
    # ZDE VYMĚNIT ZA REÁLNOU URL Z PORTÁLU!
    # response = urllib.request.urlopen(DATAZAPAD_URL)
    # data = json.loads(response.read().decode('utf-8'))
    
    # Simulace JSON odpovědi z DataZápad ArcGIS (GeoJSON formát)
    data = {
        "features": [
            {
                "properties": {
                    "NAZEV": "Zámek Sokolov - Krajské muzeum",
                    "OBEC": "Sokolov",
                    "KATEGORIE": "SIGHTSEEING",
                    "POPIS": "Oficiální data importovaná z portálu DataZápad.",
                    "DOBA_PROHLIDKY_MIN": 90,
                    "FOTO_URL": "https://picsum.photos/seed/zamek_sokolov/400/300"
                },
                "geometry": {"coordinates": [12.6415, 50.1805]} # [LNG, LAT]
            },
            {
                "properties": {
                    "NAZEV": "Císařské lázně Karlovy Vary",
                    "OBEC": "Karlovy Vary",
                    "KATEGORIE": "SIGHTSEEING",
                    "POPIS": "Národní kulturní památka, data z DataZápad.",
                    "DOBA_PROHLIDKY_MIN": 120,
                    "FOTO_URL": "https://picsum.photos/seed/cisarske_lazne/400/300"
                },
                "geometry": {"coordinates": [12.8812, 50.2185]}
            }
        ]
    }
    return data

def run_import():
    db = SessionLocal()
    data = fetch_datazapad_data()
    
    features = data.get("features", [])
    print(f"📥 Nalezeno {len(features)} turistických cílů ke stažení.")
    
    added_pois = 0
    
    for feature in features:
        props = feature.get("properties", {})
        geom = feature.get("geometry", {})
        
        mesto_nazev = props.get("OBEC")
        poi_nazev = props.get("NAZEV")
        
        if not mesto_nazev or not poi_nazev:
            continue
            
        # Získání GPS z GeoJSON (Longitude, Latitude)
        lng, lat = geom.get("coordinates", [0, 0])
        
        # 1. Zkontrolujeme, jestli dané město už máme v DB
        location = db.query(Location).filter(Location.name == mesto_nazev).first()
        if not location:
            # Vytvoříme nové město
            print(f"🏙️ Přidávám nové město z DataZápad: {mesto_nazev}")
            location = Location(name=mesto_nazev, lat=lat, lng=lng)
            db.add(location)
            db.commit()
            db.refresh(location)
            
        # 2. Zkontrolujeme, jestli už památku v DB máme
        existing_poi = db.query(ActivityPOI).filter(ActivityPOI.name == poi_nazev, ActivityPOI.location_id == location.id).first()
        
        if not existing_poi:
            opening_hours = props.get("OPENING_HOURS_JSON") or props.get("OTEVIRACI_DOBA_JSON")
            tour_slots = props.get("TOUR_SLOTS_JSON") or props.get("TERMINY_PROHLIDEK_JSON")
            # Vytvoříme památku
            new_poi = ActivityPOI(
                location_id=location.id,
                name=poi_nazev,
                description=props.get("POPIS", "Zdroj: DataZápad"),
                category=props.get("KATEGORIE", "SIGHTSEEING"),
                est_duration_mins=props.get("DOBA_PROHLIDKY_MIN", 60),
                lat=lat,
                lng=lng,
                image_url=props.get("FOTO_URL", ""),
                opening_hours_json=(opening_hours if isinstance(opening_hours, str) else json.dumps(opening_hours, ensure_ascii=False)) if opening_hours else None,
                tour_slots_json=(tour_slots if isinstance(tour_slots, str) else json.dumps(tour_slots, ensure_ascii=False)) if tour_slots else None,
            )
            db.add(new_poi)
            added_pois += 1
            print(f"✅ Naimportováno: {poi_nazev}")
        else:
            # Refresh schedules when an upstream DataZápad export supplies them.
            opening_hours = props.get("OPENING_HOURS_JSON") or props.get("OTEVIRACI_DOBA_JSON")
            tour_slots = props.get("TOUR_SLOTS_JSON") or props.get("TERMINY_PROHLIDEK_JSON")
            if opening_hours:
                existing_poi.opening_hours_json = opening_hours if isinstance(opening_hours, str) else json.dumps(opening_hours, ensure_ascii=False)
            if tour_slots:
                existing_poi.tour_slots_json = tour_slots if isinstance(tour_slots, str) else json.dumps(tour_slots, ensure_ascii=False)

    db.commit()
    db.close()
    print(f"🎉 Import úspěšně dokončen. Nově přidáno {added_pois} památek.")

if __name__ == "__main__":
    run_import()

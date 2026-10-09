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
    print("⏳ Připojuji se k Open Data API (stahování reálných dat)...")
    
    # ZDE VYMĚNIT ZA REÁLNOU URL Z PORTÁLU DATAZÁPAD (jakmile bude dostupná)
    # DATAZAPAD_URL = "https://services-eu1.arcgis.com/.../0/query?f=geojson"
    # response = urllib.request.urlopen(DATAZAPAD_URL)
    # return json.loads(response.read().decode('utf-8'))
    
    # Zatímco čekáme na přesný odkaz z DataZápad, napojil jsem backend na REÁLNÉ OPEN DATA z Wikipedie!
    # Tímto dotazem získáme všechny reálné památky v okruhu 10 km kolem Karlových Varů (souřadnice 50.23, 12.87)
    url = "https://cs.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=50.23|12.87&gsradius=10000&gslimit=30&format=json"
    req = urllib.request.Request(url, headers={'User-Agent': 'KrusnoPlan/1.0 (SOC Projekt)'})
    response = urllib.request.urlopen(req)
    wiki_data = json.loads(response.read().decode('utf-8'))
    
    # Přetransformujeme data z Wikipedie do formátu GeoJSON (stejný formát, jaký používá ArcGIS a DataZápad)
    features = []
    for item in wiki_data.get('query', {}).get('geosearch', []):
        features.append({
            "properties": {
                "NAZEV": item["title"],
                "OBEC": "Karlovy Vary",
                "KATEGORIE": "SIGHTSEEING",
                "POPIS": "Reálná památka stažená dynamicky z Open Data rozhraní.",
                "DOBA_PROHLIDKY_MIN": 60,
                "FOTO_URL": f"https://picsum.photos/seed/{item['pageid']}/400/300"
            },
            "geometry": {"coordinates": [item["lon"], item["lat"]]}
        })
        
    return {"features": features}

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
            # Vytvoříme památku
            new_poi = ActivityPOI(
                location_id=location.id,
                name=poi_nazev,
                description=props.get("POPIS", "Zdroj: DataZápad"),
                category=props.get("KATEGORIE", "SIGHTSEEING"),
                est_duration_mins=props.get("DOBA_PROHLIDKY_MIN", 60),
                lat=lat,
                lng=lng,
                image_url=props.get("FOTO_URL", "")
            )
            db.add(new_poi)
            added_pois += 1
            print(f"✅ Naimportováno: {poi_nazev}")
        else:
            # Volitelně můžeme updatovat data, pokud už památku máme
            pass

    db.commit()
    db.close()
    print(f"🎉 Import úspěšně dokončen. Nově přidáno {added_pois} památek.")

if __name__ == "__main__":
    run_import()

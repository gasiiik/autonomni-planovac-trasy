"""
Import ubytování v Karlovarském kraji z OpenStreetMap (Overpass API, licence ODbL).

DataZápad seznam ubytování nemá (jen souhrnné statistiky), proto bereme hotely, penziony,
apartmány, chaty, hostely a kempy z OpenStreetMap. Plánovač dovolené pak u každé navštívené obce
nabídne nejbližší ubytování.

- Kraj se stahuje po čtyřech částech a každá se při přetížení serveru zkouší znovu.
- Část, která se nestáhne, zůstane v DB z minula (nic se nesmaže).

Spuštění (v kontejneru):  docker exec backend-python_engine-1 python scripts/import_ubytovani.py
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.models import Accommodation

DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://api_user:api_password@localhost:3306/krusnoplan")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

USER_AGENT = "KrusnoPlan/1.0 (https://github.com/gasiiik/autonomni-planovac-trasy)"
SERVERS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"]
# Karlovarský kraj rozdělený na 4 obdélníky (celý najednou veřejné servery často nezvládnou)
TILES = [(49.85, 12.08, 50.16, 12.70), (49.85, 12.70, 50.16, 13.32),
         (50.16, 12.08, 50.47, 12.70), (50.16, 12.70, 50.47, 13.32)]
KINDS = "hotel|guest_house|hostel|motel|camp_site|chalet|apartment"


def fetch_tile(tile):
    s, w, n, e = tile
    query = f'[out:json][timeout:60];nwr({s},{w},{n},{e})["tourism"~"^({KINDS})$"]["name"];out center tags;'
    for attempt in range(6):
        server = SERVERS[attempt % len(SERVERS)]
        try:
            req = urllib.request.Request(server, data=("data=" + urllib.parse.quote(query)).encode(),
                                         headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=90) as resp:
                return json.load(resp)["elements"]
        except Exception as e:
            print(f"   ⚠ {tile} {server.split('/')[2]}: {e} – zkusím znovu")
            time.sleep(5 + attempt * 5)
    return None


def to_row(el):
    t = el.get("tags", {})
    lat = el.get("lat") or el.get("center", {}).get("lat")
    lng = el.get("lon") or el.get("center", {}).get("lon")
    if lat is None or lng is None:
        return None
    street = t.get("addr:street") or t.get("addr:place")
    number = t.get("addr:housenumber") or t.get("addr:conscriptionnumber")
    city = t.get("addr:city")
    address = ", ".join(x for x in (" ".join(y for y in (street, number) if y), city) if x) or None
    stars = t.get("stars", "")
    return {
        "osm_id": f"{el['type']}/{el['id']}",
        "name": t["name"][:200],
        "kind": t["tourism"],
        "lat": float(lat),
        "lng": float(lng),
        "stars": int(stars[0]) if stars[:1].isdigit() else None,
        "website": (t.get("website") or t.get("contact:website") or "")[:255] or None,
        "phone": (t.get("phone") or t.get("contact:phone") or "")[:50] or None,
        "address": address[:255] if address else None,
    }


def run_import():
    Accommodation.__table__.create(bind=engine, checkfirst=True)
    print("⏳ Stahuji ubytování z OpenStreetMap...")
    rows = {}
    for tile in TILES:
        els = fetch_tile(tile)
        if els is None:
            print(f"   ✖ {tile}: nepodařilo se stáhnout, ponechávám data z minula")
            continue
        for el in els:
            row = to_row(el)
            if row:
                rows[row["osm_id"]] = row
        print(f"   ✔ {tile}: {len(els)} ubytování")

    db = SessionLocal()
    try:
        existing = {a.osm_id: a for a in db.query(Accommodation).all()}
        added = updated = 0
        for osm_id, row in rows.items():
            if osm_id in existing:
                for k, v in row.items():
                    setattr(existing[osm_id], k, v)
                updated += 1
            else:
                db.add(Accommodation(**row))
                added += 1
        db.commit()
        print(f"🛏️  Ubytování: přidáno {added}, aktualizováno {updated}, celkem v DB {db.query(Accommodation).count()}.")
    finally:
        db.close()


if __name__ == "__main__":
    run_import()

"""
Import restaurací, kaváren a hospod v Karlovarském kraji z OpenStreetMap (Overpass API, licence ODbL).

DataZápad z gastronomie obsahuje jen pivovary, proto pro zastávku na oběd bereme podniky
z OpenStreetMap. Ukládají se zvlášť (tabulka restaurants), ne mezi turistické cíle - plánovač je
používá jen pro jídlo, turistické cíle zůstávají z DataZápadu.

Spuštění (v kontejneru):  docker exec backend-python_engine-1 python scripts/import_restaurace.py
"""
import os
import re
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.models import Restaurant
from scripts.import_ubytovani import SessionLocal, TILES, engine, fetch_tile

FOOD_FILTER = '["amenity"~"^(restaurant|cafe|pub|biergarten)$"]'

# Kavárny na čerpacích stanicích (Stop Cafe, Shell Café...) - na oběd při výletu se nehodí
_FUEL = re.compile(r"stop ?caf|orlen|benzina|shell|\bomv\b|\bmol\b|eurooil|robinoil|tank ?ono|čerpací|benzín", re.I)


def is_fuel_station(t):
    text = " ".join(t.get(k, "") for k in ("name", "brand", "operator", "website", "contact:website"))
    return bool(_FUEL.search(text))


def to_row(el):
    t = el.get("tags", {})
    if is_fuel_station(t):
        return None
    lat = el.get("lat") or el.get("center", {}).get("lat")
    lng = el.get("lon") or el.get("center", {}).get("lon")
    if lat is None or lng is None:
        return None
    street = t.get("addr:street") or t.get("addr:place")
    number = t.get("addr:housenumber") or t.get("addr:conscriptionnumber")
    city = t.get("addr:city")
    address = ", ".join(x for x in (" ".join(y for y in (street, number) if y), city) if x) or None
    return {
        "osm_id": f"{el['type']}/{el['id']}",
        "name": t["name"][:200],
        "kind": t["amenity"],
        "lat": float(lat),
        "lng": float(lng),
        "cuisine": (t.get("cuisine") or "")[:100] or None,
        "opening_hours": (t.get("opening_hours") or "")[:255] or None,
        "website": (t.get("website") or t.get("contact:website") or "")[:255] or None,
        "address": address[:255] if address else None,
        "vegetarian": 1 if t.get("diet:vegetarian") in ("yes", "only") or t.get("diet:vegan") in ("yes", "only") else 0,
    }


def run_import():
    Restaurant.__table__.create(bind=engine, checkfirst=True)
    print("⏳ Stahuji restaurace a kavárny z OpenStreetMap...")
    rows = {}
    for tile in TILES:
        els = fetch_tile(tile, FOOD_FILTER)
        if els is None:
            print(f"   ✖ {tile}: nepodařilo se stáhnout, ponechávám data z minula")
            continue
        for el in els:
            row = to_row(el)
            if row:
                rows[row["osm_id"]] = row
        print(f"   ✔ {tile}: {len(els)} podniků")

    db = SessionLocal()
    try:
        existing = {r.osm_id: r for r in db.query(Restaurant).all()}
        added = updated = 0
        # Podniky, které nově vyřazujeme (benzínky), z DB smažeme - jen u úspěšně stažených částí kraje
        for osm_id, r in list(existing.items()):
            if osm_id not in rows and _FUEL.search(" ".join(x or "" for x in (r.name, r.website))):
                db.delete(r)
                del existing[osm_id]
        for osm_id, row in rows.items():
            if osm_id in existing:
                for k, v in row.items():
                    setattr(existing[osm_id], k, v)
                updated += 1
            else:
                db.add(Restaurant(**row))
                added += 1
        db.commit()
        print(f"🍽️  Restaurace: přidáno {added}, aktualizováno {updated}, celkem v DB {db.query(Restaurant).count()}.")
    finally:
        db.close()


if __name__ == "__main__":
    run_import()

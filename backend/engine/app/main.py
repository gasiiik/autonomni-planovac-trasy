from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import math
from datetime import datetime, timedelta
import urllib.request
import json

from .database import get_db
from .models import Location, ActivityPOI

app = FastAPI(title="KrušnoPlán Python Engine - Pokročilé Trasování")

class RouteType(str):
    ONE_WAY = "ONE_WAY"
    LOOP = "LOOP"

class PlanRequest(BaseModel):
    location_id: int
    time_from: str # formát "YYYY-MM-DD HH:MM:SS" (co je teď)
    time_to: str   # formát "YYYY-MM-DD HH:MM:SS" (do kdy má čas)
    transport_mode: str # WALK, BIKE, CAR
    route_type: str # ONE_WAY nebo LOOP
    interests: List[str] # ["RUNNING", "WALKING", "GASTRO", "FESTIVAL", "EVENT", "SIGHTSEEING"]

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

def get_weather_info(lat: float, lng: float):
    # Dynamické plánování počasí přes Open-Meteo API
    try:
        url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lng}&current_weather=true"
        req = urllib.request.Request(url, headers={'User-Agent': 'KrusnoPlan/1.0'})
        response = urllib.request.urlopen(req, timeout=3)
        data = json.loads(response.read().decode('utf-8'))
        weathercode = data.get("current_weather", {}).get("weathercode", 0)
        
        # WMO Kódy: 50+ znamená déšť, sníh, bouřky
        if weathercode >= 50:
            return "BAD_WEATHER"
        return "GOOD_WEATHER"
    except Exception:
        return "UNKNOWN"

@app.get("/internal/locations")
def get_locations(db: Session = Depends(get_db)):
    return db.query(Location).all()

@app.post("/internal/planner/generate")
def generate_plan(req: PlanRequest, db: Session = Depends(get_db)):
    t_from = datetime.strptime(req.time_from, "%Y-%m-%d %H:%M:%S")
    t_to = datetime.strptime(req.time_to, "%Y-%m-%d %H:%M:%S")
    
    # Validace: Nelze plánovat do minulosti
    now = datetime.now()
    if t_from.date() < now.date():
        raise HTTPException(status_code=400, detail="Nelze plánovat trasu na datum v minulosti.")
    if t_from.date() == now.date() and t_from.time() < now.time():
        raise HTTPException(status_code=400, detail="Nelze plánovat trasu na čas, který již dnes proběhl.")

    total_mins = int((t_to - t_from).total_seconds() / 60)
    
    if total_mins <= 0:
        raise HTTPException(status_code=400, detail="Čas 'do' musí být větší než čas 'od'.")

    # Filtrujeme aktivity podle vybraných preferencí
    pois = db.query(ActivityPOI).filter(
        ActivityPOI.location_id == req.location_id,
        ActivityPOI.category.in_(req.interests)
    ).all()

    loc = db.query(Location).filter(Location.id == req.location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Lokace nenalezena.")

    # 1. Zohlednění počasí
    weather_status = get_weather_info(loc.lat, loc.lng)
    weather_message = "Počasí je ideální pro jakékoliv aktivity."
    
    if weather_status == "BAD_WEATHER":
        weather_message = "V destinaci prší/sněží! Trasa byla automaticky upravena a zaměřena na vnitřní aktivity."
        # Vyfiltrujeme venkovní aktivity, pokud máme z čeho jiného vybírat
        indoor_pois = [p for p in pois if p.category not in ["PARK", "RUNNING", "OUTDOOR"]]
        if len(indoor_pois) > 0:
            pois = indoor_pois

    # Klonování listu POI pro algoritmus "Nejbližší soused" (Nearest Neighbor)
    unvisited = pois[:]
    
    current_time = t_from
    remaining_mins = total_mins
    
    start_lat, start_lng = loc.lat, loc.lng
    curr_lat, curr_lng = start_lat, start_lng
    
    waypoints_for_map = [{"lat": start_lat, "lng": start_lng, "name": loc.name, "type": "START"}]
    itinerary = []

    while unvisited:
        # Najdi nejbližší památku k aktuální poloze
        closest_poi = None
        min_dist = float('inf')
        
        for p in unvisited:
            # 2. Zohlednění otevírací doby (Opening Hours)
            try:
                # Odhad času příjezdu k památce
                dist_approx = haversine_distance(curr_lat, curr_lng, p.lat, p.lng)
                time_approx = calc_travel_time(dist_approx, req.transport_mode)
                arrival_time = current_time + timedelta(minutes=time_approx)
                
                # Zpracování open_time a close_time
                oh_h, oh_m = map(int, p.open_time.split(':'))
                ct_h, ct_m = map(int, p.close_time.split(':'))
                
                open_dt = arrival_time.replace(hour=oh_h, minute=oh_m, second=0)
                close_dt = arrival_time.replace(hour=ct_h, minute=ct_m, second=0)
                
                # Pokud dorazíme před otvíračkou, nebo nestihneme prohlídku před zavíračkou, přeskočíme
                if arrival_time < open_dt or (arrival_time + timedelta(minutes=p.est_duration_mins)) > close_dt:
                    continue
            except Exception:
                pass # Pokud chybí data otevírací doby (např. park), ignorujeme a necháme projít
                
            dist = haversine_distance(curr_lat, curr_lng, p.lat, p.lng)
            if dist < min_dist:
                min_dist = dist
                closest_poi = p
                
        # Pokud už není žádná památka otevřená, ukončíme hledání
        if closest_poi is None:
            break
            
        poi = closest_poi
        unvisited.remove(poi)

        dist_km = min_dist
        travel_time = calc_travel_time(dist_km, req.transport_mode)
        
        # Pokud je to OKRUH, musíme si nechat rezervu na návrat
        return_time = 0
        if req.route_type.upper() == "LOOP":
            return_dist = haversine_distance(poi.lat, poi.lng, start_lat, start_lng)
            return_time = calc_travel_time(return_dist, req.transport_mode)
        
        total_time_needed = travel_time + poi.est_duration_mins + return_time
        
        if remaining_mins >= total_time_needed:
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
                "image_url": poi.image_url
            })
            waypoints_for_map.append({"lat": poi.lat, "lng": poi.lng, "name": poi.name, "type": "POI"})
            
            current_time += timedelta(minutes=poi.est_duration_mins)
            remaining_mins -= poi.est_duration_mins
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

    return {
        "status": "success",
        "message": weather_message,
        "weather_status": weather_status,
        "location": loc.name,
        "route_type": req.route_type,
        "transport_mode": req.transport_mode,
        "waypoints": waypoints_for_map,
        "itinerary": itinerary,
        "remaining_free_time_mins": remaining_mins,
        "total_planned_time": total_mins - remaining_mins
    }

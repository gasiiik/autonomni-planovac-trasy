from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import math
from datetime import datetime, timedelta

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

@app.get("/internal/locations")
def get_locations(db: Session = Depends(get_db)):
    return db.query(Location).all()

@app.post("/internal/planner/generate")
def generate_plan(req: PlanRequest, db: Session = Depends(get_db)):
    t_from = datetime.strptime(req.time_from, "%Y-%m-%d %H:%M:%S")
    t_to = datetime.strptime(req.time_to, "%Y-%m-%d %H:%M:%S")
    total_mins = int((t_to - t_from).total_seconds() / 60)
    
    if total_mins <= 0:
        raise HTTPException(status_code=400, detail="Čas 'do' musí být větší než aktuální čas.")

    # Filtrujeme aktivity podle vybraných preferencí
    pois = db.query(ActivityPOI).filter(
        ActivityPOI.location_id == req.location_id,
        ActivityPOI.category.in_(req.interests)
    ).all()

    loc = db.query(Location).filter(Location.id == req.location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Lokace nenalezena.")

    itinerary = []
    current_time = t_from
    remaining_mins = total_mins
    
    start_lat, start_lng = loc.lat, loc.lng
    curr_lat, curr_lng = start_lat, start_lng
    
    # Uložení pro frontendovou mapu (Google Maps / Leaflet)
    waypoints_for_map = [{"lat": start_lat, "lng": start_lng, "name": loc.name, "type": "START"}]

    for poi in pois:
        dist_km = haversine_distance(curr_lat, curr_lng, poi.lat, poi.lng)
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
                "lng": poi.lng
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
        "location": loc.name,
        "route_type": req.route_type,
        "transport_mode": req.transport_mode,
        "waypoints": waypoints_for_map,
        "itinerary": itinerary,
        "remaining_free_time_mins": remaining_mins,
        "total_planned_time": total_mins - remaining_mins
    }

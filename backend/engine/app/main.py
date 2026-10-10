from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import math
import json
from datetime import datetime, timedelta

from .database import get_db, ensure_planner_columns
from .models import Location, ActivityPOI

app = FastAPI(title="KrušnoPlán Python Engine - Pokročilé Trasování")


@app.on_event("startup")
def upgrade_planner_schema():
    ensure_planner_columns()

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


def _schedule_json(raw):
    if not raw:
        return None
    try:
        value = json.loads(raw) if isinstance(raw, str) else raw
        return value if isinstance(value, dict) else None
    except (TypeError, ValueError):
        return None


def _minutes(value):
    parsed = datetime.strptime(value, "%H:%M")
    return parsed.hour * 60 + parsed.minute


def _day_entries(schedule, day):
    # Accept ISO weekday keys and common English/Czech weekday abbreviations.
    names = {
        1: ("1", "mon", "monday", "po", "pondeli", "pondělí"),
        2: ("2", "tue", "tuesday", "ut", "út", "utery", "úterý"),
        3: ("3", "wed", "wednesday", "st", "st", "streda", "středa"),
        4: ("4", "thu", "thursday", "ct", "čt", "ctvrtek", "čtvrtek"),
        5: ("5", "fri", "friday", "pa", "pá", "patek", "pátek"),
        6: ("6", "sat", "saturday", "so", "sobota"),
        7: ("7", "sun", "sunday", "ne", "neděle"),
    }
    for key in names[day]:
        if key in schedule:
            return schedule[key]
    return None


def _opening_intervals(poi, day):
    schedule = _schedule_json(poi.opening_hours_json)
    if schedule is None:
        return None  # Unknown hours: keep the POI, but do not claim verified availability.
    entries = _day_entries(schedule, day)
    if entries is None or entries is False or entries == "closed":
        return []
    if isinstance(entries, dict):
        entries = entries.get("intervals", [])
    if isinstance(entries, str):
        entries = [entries.split("-")] if "-" in entries else []
    if not isinstance(entries, list):
        return []
    intervals = []
    for entry in entries:
        try:
            if isinstance(entry, str):
                start, end = entry.split("-", 1)
            else:
                start, end = entry[0], entry[1]
            left, right = _minutes(start.strip()), _minutes(end.strip())
            if right <= left:
                right += 24 * 60
            intervals.append((left, right))
        except (IndexError, TypeError, ValueError):
            continue
    return sorted(intervals)


def _tour_slots(poi, day):
    schedule = _schedule_json(poi.tour_slots_json)
    if schedule is None:
        return None
    entries = _day_entries(schedule, day)
    if entries is None or entries is False or entries == "closed":
        return []
    if isinstance(entries, dict):
        entries = entries.get("slots", [])
    if not isinstance(entries, list):
        return []
    slots = []
    for entry in entries:
        try:
            slots.append(_minutes(entry if isinstance(entry, str) else entry["start"]))
        except (KeyError, TypeError, ValueError):
            continue
    return sorted(slots)


def _next_visit_start(poi, arrival, duration):
    """Return the next feasible visit/tour start and its wait, or None if unavailable."""
    arrival_min = arrival.hour * 60 + arrival.minute
    openings = _opening_intervals(poi, arrival.isoweekday())
    tours = _tour_slots(poi, arrival.isoweekday())

    if tours is not None:
        for slot in tours:
            start = max(slot, arrival_min)
            # A scheduled guided tour cannot be joined after it has started.
            if slot < arrival_min:
                continue
            if openings is not None and not any(a <= start and start + duration <= b for a, b in openings):
                continue
            return arrival.replace(hour=start // 60, minute=start % 60, second=0, microsecond=0), start - arrival_min
        return None

    if openings is None:
        return arrival, 0
    for opened, closed in openings:
        start = max(opened, arrival_min)
        if start + duration <= closed:
            return arrival.replace(hour=(start % (24 * 60)) // 60, minute=start % 60, second=0, microsecond=0), start - arrival_min
    return None

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
    pois = [poi for poi in pois if poi.lat is not None and poi.lng is not None]

    loc = db.query(Location).filter(Location.id == req.location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Lokace nenalezena.")

    start_lat, start_lng = loc.lat, loc.lng
    route_loop = req.route_type.upper() == "LOOP"
    unvisited = pois[:]
    stops = []
    current_time = t_from
    curr_lat, curr_lng = start_lat, start_lng

    # Build a schedule-aware nearest-neighbour route. Nearby stops are grouped
    # naturally; waiting until a tour slot counts against the user's time budget.
    while unvisited:
        options = []
        for poi in unvisited:
            visit_duration = max(0, poi.est_duration_mins or 0)
            dist_km = haversine_distance(curr_lat, curr_lng, poi.lat, poi.lng)
            travel_mins = calc_travel_time(dist_km, req.transport_mode)
            arrival = current_time + timedelta(minutes=travel_mins)
            visit = _next_visit_start(poi, arrival, visit_duration)
            if visit is None:
                continue
            visit_start, wait_mins = visit
            visit_end = visit_start + timedelta(minutes=visit_duration)
            return_mins = 0
            if route_loop:
                return_dist = haversine_distance(poi.lat, poi.lng, start_lat, start_lng)
                return_mins = calc_travel_time(return_dist, req.transport_mode)
            if visit_end + timedelta(minutes=return_mins) > t_to:
                continue
            # Prioritize short, direct legs; small waiting cost breaks ties toward
            # places whose next available guided tour is sooner.
            score = travel_mins + wait_mins * 0.35
            options.append((score, dist_km, poi.id, poi, travel_mins, arrival, visit_start, wait_mins, visit_end))

        if not options:
            break
        _, _, _, poi, _, _, _, _, visit_end = min(options, key=lambda item: item[:3])
        unvisited.remove(poi)
        stops.append(poi)
        current_time = visit_end
        curr_lat, curr_lng = poi.lat, poi.lng

    # Improve the selected order using relocate moves. Accept only arrangements
    # that keep every selected stop available and fit the user's time window.
    def evaluate_order(order):
        time = t_from
        lat, lng = start_lat, start_lng
        drive_mins = 0
        wait_total = 0
        for stop in order:
            duration = max(0, stop.est_duration_mins or 0)
            distance = haversine_distance(lat, lng, stop.lat, stop.lng)
            leg_mins = calc_travel_time(distance, req.transport_mode)
            arrival = time + timedelta(minutes=leg_mins)
            visit = _next_visit_start(stop, arrival, duration)
            if visit is None:
                return None
            visit_start, wait = visit
            time = visit_start + timedelta(minutes=duration)
            lat, lng = stop.lat, stop.lng
            drive_mins += leg_mins
            wait_total += wait
        if route_loop and order:
            return_mins = calc_travel_time(haversine_distance(lat, lng, start_lat, start_lng), req.transport_mode)
            drive_mins += return_mins
            time += timedelta(minutes=return_mins)
        if time > t_to:
            return None
        return drive_mins + wait_total * 0.35

    best_score = evaluate_order(stops)
    improved = True
    while improved and len(stops) > 2:
        improved = False
        best_move = None
        for source in range(len(stops)):
            for target in range(len(stops)):
                if source == target or target == source + 1:
                    continue
                candidate = stops[:]
                moved = candidate.pop(source)
                candidate.insert(target, moved)
                score = evaluate_order(candidate)
                if score is not None and score + 0.01 < (best_score if best_score is not None else float("inf")):
                    best_score, best_move = score, candidate
        if best_move is not None:
            stops, improved = best_move, True

    # Rebuild the itinerary from the final optimized order.
    itinerary = []
    waypoints_for_map = [{"lat": start_lat, "lng": start_lng, "name": loc.name, "type": "START"}]
    current_time = t_from
    curr_lat, curr_lng = start_lat, start_lng
    for poi in stops:
        duration = max(0, poi.est_duration_mins or 0)
        dist_km = haversine_distance(curr_lat, curr_lng, poi.lat, poi.lng)
        travel_mins = calc_travel_time(dist_km, req.transport_mode)
        arrival = current_time + timedelta(minutes=travel_mins)
        visit_start, wait_mins = _next_visit_start(poi, arrival, duration)
        if travel_mins > 0:
            itinerary.append({
                "type": "travel", "start": current_time.strftime("%H:%M"),
                "end": arrival.strftime("%H:%M"), "mode": req.transport_mode,
                "distance_km": round(dist_km, 2), "duration_mins": travel_mins,
            })
        if wait_mins > 0:
            is_tour = _tour_slots(poi, arrival.isoweekday()) is not None
            itinerary.append({
                "type": "wait", "start": arrival.strftime("%H:%M"),
                "end": visit_start.strftime("%H:%M"), "title": (
                    "Čekání na začátek prohlídky" if is_tour else "Čekání na otevření"
                ), "duration_mins": wait_mins,
            })
        visit_end = visit_start + timedelta(minutes=duration)
        itinerary.append({
            "type": "poi", "start": visit_start.strftime("%H:%M"),
            "end": visit_end.strftime("%H:%M"), "title": poi.name,
            "category": poi.category, "duration_mins": duration,
            "lat": poi.lat, "lng": poi.lng, "image_url": poi.image_url,
            "opening_hours_known": _schedule_json(poi.opening_hours_json) is not None,
            "tour_schedule_known": _schedule_json(poi.tour_slots_json) is not None,
        })
        waypoints_for_map.append({"lat": poi.lat, "lng": poi.lng, "name": poi.name, "type": "POI"})
        curr_lat, curr_lng, current_time = poi.lat, poi.lng, visit_end

    if route_loop and stops:
        final_dist = haversine_distance(curr_lat, curr_lng, start_lat, start_lng)
        final_travel = calc_travel_time(final_dist, req.transport_mode)
        itinerary.append({
            "type": "travel_return", "start": current_time.strftime("%H:%M"),
            "end": (current_time + timedelta(minutes=final_travel)).strftime("%H:%M"),
            "mode": req.transport_mode, "title": "Návrat do výchozího bodu",
            "distance_km": round(final_dist, 2), "duration_mins": final_travel,
        })
        current_time += timedelta(minutes=final_travel)
        waypoints_for_map.append({"lat": start_lat, "lng": start_lng, "name": "Cíl - Návrat", "type": "END_LOOP"})

    used_mins = max(0, int((current_time - t_from).total_seconds() / 60))
    remaining_mins = max(0, total_mins - used_mins)

    return {
        "status": "success",
        "location": loc.name,
        "route_type": req.route_type,
        "transport_mode": req.transport_mode,
        "waypoints": waypoints_for_map,
        "itinerary": itinerary,
        "remaining_free_time_mins": remaining_mins,
        "total_planned_time": used_mins
    }

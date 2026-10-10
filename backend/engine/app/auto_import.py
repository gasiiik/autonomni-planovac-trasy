"""Automatický import dat z DataZápad při startu enginu.

Aplikace tak nikdy neběží s prázdnou databází a data se samy obnoví, když jsou starší než
AUTO_IMPORT_MAX_AGE_DAYS (výchozí 7 dní). Import běží ve vlákně na pozadí - API mezitím odpovídá
(nad dosavadními daty). Vypnutí: proměnná prostředí AUTO_IMPORT=0.
"""
import os
import threading
import time
import traceback
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, text

from .database import SessionLocal, engine
from .models import Accommodation, Dataset

MAX_AGE_DAYS = int(os.getenv("AUTO_IMPORT_MAX_AGE_DAYS", "7"))

# Stav automatického importu (běží-li právě, poslední chyba)
state = {"running": False, "last_error": None}


def wait_for_db(attempts=60):
    """MariaDB startuje déle než engine (depends_on nečeká na připravenost databáze)."""
    for _ in range(attempts):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return True
        except Exception:
            time.sleep(2)
    return False


def last_import():
    db = SessionLocal()
    try:
        return db.query(func.max(Dataset.imported_at)).scalar()
    finally:
        db.close()


def _run():
    if not wait_for_db():
        state["last_error"] = "Databáze není dostupná."
        return
    Dataset.__table__.create(bind=engine, checkfirst=True)
    Accommodation.__table__.create(bind=engine, checkfirst=True)

    # Ubytování z OpenStreetMap (pro dovolenou) - stačí jednou, když v DB ještě žádné není
    db = SessionLocal()
    try:
        has_stays = db.query(Accommodation).first() is not None
    finally:
        db.close()
    if not has_stays:
        try:
            from scripts.import_ubytovani import run_import as import_stays
            import_stays()
        except Exception:
            traceback.print_exc()

    last = last_import()
    now = datetime.now(ZoneInfo("Europe/Prague")).replace(tzinfo=None)
    if last and now - last < timedelta(days=MAX_AGE_DAYS):
        print(f"ℹ️  Data z DataZápad jsou aktuální (poslední import {last:%d.%m.%Y %H:%M}), import přeskakuji.")
        return

    state["running"] = True
    try:
        from scripts.import_datazapad import run_import
        run_import(with_images=True)
        state["last_error"] = None
    except Exception as e:
        state["last_error"] = str(e)
        traceback.print_exc()
    finally:
        state["running"] = False


def start():
    if os.getenv("AUTO_IMPORT", "1") != "1":
        return
    threading.Thread(target=_run, name="datazapad-import", daemon=True).start()

"""Fotky míst přes náš server.

Prohlížeč nestahuje fotky přímo z Wikimedie a webů provozovatelů: Wikimedia při desítkách obrázků
najednou odpovídá 429 (Too Many Requests) a část fotek se nenačte. Server každou fotku stáhne jednou
(pomalu, s opakováním), uloží ji na disk a dál ji posílá sám. Slouží jen fotky, které jsou v databázi
(nejde o otevřenou proxy).
"""
import hashlib
import os
import threading
import time
import urllib.request
from pathlib import Path

from sqlalchemy import text

PHOTO_DIR = Path(os.getenv("PHOTO_CACHE_DIR", "/data/photos"))
USER_AGENT = "NaplanujTo/1.0 (https://github.com/gasiiik/autonomni-planovac-trasy; SOC projekt - planovac tras)"
MAX_BYTES = 8 * 1024 * 1024
_upstream = threading.Semaphore(2)    # nejvýš 2 stahování najednou (ohleduplně k Wikimedii)


def cache_path(url: str) -> Path:
    return PHOTO_DIR / hashlib.sha1(url.encode("utf-8")).hexdigest()


def cached(url: str):
    """(soubor, content-type), pokud je fotka stažená."""
    path = cache_path(url)
    ctype = path.with_suffix(".type")
    if path.exists() and ctype.exists():
        return path, ctype.read_text().strip()
    return None


def known_photo(db, url: str) -> bool:
    return db.execute(text("SELECT 1 FROM activity_pois WHERE image_url = :u LIMIT 1"), {"u": url}).first() is not None


def download(url: str):
    """Stáhne fotku do cache. Při 429/503 počká a zkusí znovu. Vrací (soubor, content-type) nebo None."""
    hit = cached(url)
    if hit:
        return hit
    PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    headers = {"User-Agent": USER_AGENT, "Accept": "image/avif,image/webp,image/jpeg,image/*;q=0.8"}
    with _upstream:
        for attempt in range(4):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=20) as resp:
                    ctype = resp.headers.get("Content-Type", "").split(";")[0].strip()
                    data = resp.read(MAX_BYTES + 1)
                if not ctype.startswith("image/") or len(data) > MAX_BYTES or len(data) < 500:
                    return None
                path = cache_path(url)
                tmp = path.with_suffix(".part")
                tmp.write_bytes(data)
                tmp.replace(path)
                path.with_suffix(".type").write_text(ctype)
                return path, ctype
            except urllib.error.HTTPError as e:
                if e.code in (429, 503) and attempt < 3:
                    time.sleep(2 ** attempt * 2)     # 2, 4, 8 s
                    continue
                return None
            except Exception:
                if attempt < 1:
                    time.sleep(2)
                    continue
                return None
    return None


def prefetch_all(session_factory, pause: float = 1.0):
    """Na pozadí stáhne všechny fotky z databáze, které ještě nejsou v cache (po startu, pomalu)."""
    def run():
        time.sleep(20)   # nechat doběhnout start aplikace
        db = session_factory()
        try:
            urls = [r[0] for r in db.execute(text(
                "SELECT DISTINCT image_url FROM activity_pois WHERE image_url IS NOT NULL AND image_url <> ''"))]
        except Exception:
            return
        finally:
            db.close()
        missing = [u for u in urls if not cached(u)]
        if not missing:
            return
        print(f"📷 Stahuji fotky míst do cache: {len(missing)}")
        ok = 0
        for url in missing:
            if download(url):
                ok += 1
            time.sleep(pause)
        print(f"📷 Fotky v cache: staženo {ok} z {len(missing)}")
    threading.Thread(target=run, name="photo-prefetch", daemon=True).start()

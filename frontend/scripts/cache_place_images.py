"""Download current DataZápad place photos into same-origin WebP assets.

Run from the repository root after starting Docker Compose:
  python frontend/scripts/cache_place_images.py
The original URL is retained in credits.json and in the database for attribution.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO
import json
from pathlib import Path
import sys
import urllib.error
import urllib.request
from urllib.parse import urlparse

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "images" / "places"
API_URL = "http://localhost:8080/api/places"
USER_AGENT = "KrusnoPlan/1.0 (https://github.com/gasiiik/autonomni-planovac-trasy)"
MAX_BYTES = 12 * 1024 * 1024


def get_json(url: str):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def cache_one(place):
    place_id = int(place["id"])
    source_url = place["image_url"]
    target = OUT / f"{place_id}.webp"
    if target.is_file() and target.stat().st_size > 1000:
        return place_id, source_url, "cached"
    request = urllib.request.Request(source_url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            content_type = response.headers.get("Content-Type", "")
            raw = response.read(MAX_BYTES + 1)
        if len(raw) > MAX_BYTES or (content_type and not content_type.startswith("image/")):
            return place_id, source_url, "not-an-image"
        image = Image.open(BytesIO(raw))
        image = ImageOps.exif_transpose(image).convert("RGB")
        image.thumbnail((960, 720), Image.Resampling.LANCZOS)
        image.save(target, "WEBP", quality=78, method=5)
        return place_id, source_url, "downloaded"
    except (OSError, ValueError, urllib.error.URLError, TimeoutError) as exc:
        return place_id, source_url, f"failed: {type(exc).__name__}"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    places = get_json(API_URL)
    wanted = [
        p for p in places
        if (p.get("image_url") or "").startswith("https://")
        and not any(fake in p["image_url"].lower() for fake in ("unsplash.com", "picsum.photos"))
    ]
    print(f"Caching {len(wanted)} DataZápad images to {OUT}", flush=True)
    credits = {}
    places_by_id = {int(place["id"]): place for place in wanted}
    counts = {"downloaded": 0, "cached": 0, "failed": 0}
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(cache_one, place) for place in wanted]
        for index, future in enumerate(as_completed(futures), 1):
            place_id, source_url, status = future.result()
            if status in counts:
                counts[status] += 1
            else:
                counts["failed"] += 1
            place = places_by_id[place_id]
            if status in ("downloaded", "cached"):
                host = urlparse(source_url).hostname or ""
                credits[str(place_id)] = {
                    "name": place["name"],
                    "file": f"/images/places/{place_id}.webp",
                    "source_url": source_url,
                    "credit": "Wikimedia Commons" if "wikimedia.org" in host or "wikipedia.org" in host else host.removeprefix("www."),
                }
            if index % 25 == 0 or index == len(wanted):
                print(f"{index}/{len(wanted)} complete", flush=True)
    (OUT / "credits.json").write_text(json.dumps(credits, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(counts, ensure_ascii=False))
    return 0 if counts["failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())

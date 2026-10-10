"""Zjednodušené čtení otevírací doby z OpenStreetMap (tag opening_hours) pro konkrétní den.

Zvládá běžné zápisy jako "Mo-Fr 11:00-22:00; Sa,Su 12:00-20:00", "Tu-Su 10:00-14:00,17:00-22:00",
"Mo off" nebo "24/7". Složitější zápisy (svátky, měsíce, týdny) přeskočí - vrátí None a plánovač
použije běžnou otevírací dobu podle typu podniku.
"""
import re

DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
_TIME = re.compile(r"(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})")


def _days(spec: str):
    spec = spec.strip()
    if not spec:
        return set(range(7))
    result = set()
    for part in spec.split(","):
        part = part.strip()
        if "-" in part:
            a, b = (x.strip() for x in part.split("-", 1))
            if a not in DAYS or b not in DAYS:
                raise ValueError(part)
            i, j = DAYS.index(a), DAYS.index(b)
            result.update(range(i, j + 1) if i <= j else list(range(i, 7)) + list(range(0, j + 1)))
        elif part in DAYS:
            result.add(DAYS.index(part))
        elif part == "PH":
            continue  # státní svátky ignorujeme
        else:
            raise ValueError(part)
    return result


def hours_for_day(opening_hours: str, weekday: int):
    """Vrací ("HH:MM", "HH:MM") od-do pro daný den (0 = pondělí), "closed", nebo None (neznámé)."""
    if not opening_hours:
        return None
    text = opening_hours.strip()
    if text == "24/7":
        return ("00:00", "23:59")
    result = None
    parsed = False
    try:
        for rule in text.split(";"):
            rule = rule.strip()
            if not rule:
                continue
            m = re.match(r"^([A-Za-z,\-\s]*?)\s*((?:\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\s*,?\s*)+|off|closed)$", rule)
            if not m:
                return None
            days = _days(m.group(1).replace(" ", ""))
            parsed = True
            if weekday not in days:
                continue
            if m.group(2) in ("off", "closed"):
                result = "closed"
                continue
            ranges = _TIME.findall(m.group(2))
            opens = min(f"{int(a):02d}:{b}" for a, b, _, _ in ranges)
            # Zavírá po půlnoci ("18:00-02:00") nebo ve 24:00 -> pro plánování dne bereme 23:59
            closes = max("23:59" if (int(c), int(d)) >= (24, 0) or (int(c), int(d)) <= (int(a), int(b2))
                         else f"{int(c):02d}:{d}" for a, b2, c, d in ranges)
            result = (opens, closes)
    except ValueError:
        return None
    # Den, který žádné pravidlo neuvádí ("Tu-Su ..." v pondělí), má podle OpenStreetMap zavřeno
    return result if result is not None or not parsed else "closed"

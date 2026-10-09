# Změny v backendu pro plnou podporu frontendového plánovače

Tento dokument obsahuje seznam změn, které je nutné provést v backendu (v gateway i v python engine), aby byly plně podpořeny všechny funkce frontendové aplikace.

## 1. Rozšíření parametrů plánovače (Maximální čas na cestě)

**Důvod:** Ve druhém kroku průvodce uživatel zadává maximální čas, který je ochoten strávit cestou (např. v autě), aby nejezdil příliš daleko.

**Aktuální stav:** Backend aktuálně plánuje na základě celkového času (od `time_from` do `time_to`), ale neomezuje celkovou dobu strávenou samotnou přepravou.

**Požadovaná implementace:** Do plánovacího algoritmu přidat limit na celkový součet času stráveného přepravou (součet všech `duration_mins` u přesunů). Pokud je limit překročen, přeskočit vzdálenější místa.

**API kontrakt:**
* HTTP metoda: POST
* Endpoint: `/api/planner` (a v engine `/internal/planner/generate`)
* Požadovaná vstupní data: Přidat volitelný parametr `max_travel_time_mins` (int).
* Struktura úspěšné odpovědi: Beze změny (pouze se zohlední ve vygenerovaném itineráři).
* Možné chybové odpovědi: Beze změny.

**Dotčené části backendu:** `backend/engine/app/main.py` (`PlanRequest` a funkce `generate_plan`).

**Validace a bezpečnost:** Ověřit, že `max_travel_time_mins` je kladné číslo (pokud je zadáno).

**Kritéria dokončení:** Při volání s `max_travel_time_mins=30` nesmí součet trvání typu "travel" přesáhnout 30 minut.

---

## 2. Podpora rozpočtu a cenových kategorií

**Důvod:** Uživatel chce zadat celkový rozpočet (nebo alespoň preferenci levné/drahé) a ochotu platit vstupné.

**Aktuální stav:** Model `ActivityPOI` zřejmě neobsahuje pole pro cenu vstupu, a `PlanRequest` neumožňuje zadat rozpočet.

**Požadovaná implementace:** 
1. Rozšířit databázový model `ActivityPOI` o pole `price_estimated` (float) nebo `price_level` (int 1-3).
2. Upravit plánovací algoritmus tak, aby preferoval místa podle zadaného rozpočtu nebo vyřadil zpoplatněná místa, pokud uživatel nechce platit vstupné.

**API kontrakt:**
* HTTP metoda: POST
* Endpoint: `/api/planner` (a `/internal/planner/generate`)
* Požadovaná vstupní data: Přidat `budget_max` (float, volitelně), `willing_to_pay_entry` (bool).
* Struktura úspěšné odpovědi: Do položek v `itinerary` (kde `type == 'poi'`) přidat `estimated_cost` (float). Do hlavního objektu odpovědi přidat `total_estimated_cost`.

**Dotčené části backendu:** `backend/engine/app/models.py`, `backend/engine/app/main.py`.

**Kritéria dokončení:** Pokud `willing_to_pay_entry == false`, itinerář nesmí obsahovat zpoplatněná místa. Výsledný JSON obsahuje kalkulaci ceny.

---

## 3. Podpora detailních stravovacích preferencí a omezení

**Důvod:** Krok 4 vyžaduje možnost specifikovat typy podniku (restaurace, kavárna, piknik) a stravovací omezení (např. vegetariánské).

**Aktuální stav:** Backend aktuálně pouze filtruje aktivity podle obecného pole `interests` (např. `GASTRO`), ale neumí diferencovat typy jídla ani dietní požadavky.

**Požadovaná implementace:** 
Do databáze k POI bodům typu jídlo doplnit vlastnosti (tagy) o typu (kavárna, restaurace) a omezeních (vegan, bezlepkové). Algoritmus by pak vybral vhodný gastro bod v době oběda/večeře podle těchto tagů.

**API kontrakt:**
* HTTP metoda: POST
* Endpoint: `/api/planner`
* Požadovaná vstupní data: Přidat pole `food_preferences` (List[str]) - např. `["RESTAURANT", "VEGETARIAN"]`.
* Struktura úspěšné odpovědi: Beze změny, vybrané POI s kategorií GASTRO budou lépe odpovídat zadání.

**Dotčené části backendu:** `backend/engine/app/models.py` (nový sloupec `tags` JSON pro POI), algoritmus `generate_plan`.

**Kritéria dokončení:** Při volání s `"food_preferences": ["CAFE"]` se v trase místo restaurace objeví kavárna.

---

## 4. Obtížnost trasy a počet účastníků

**Důvod:** Uživatel může zadat náročnost (lehká, střední, těžká) a aplikaci pro rodiny s dětmi.

**Aktuální stav:** Algoritmus toto nezohledňuje.

**Požadovaná implementace:** POI musí mít flagy jako `family_friendly` nebo `difficulty_level`. A filtr při plánování tyto tagy zohlední.

**API kontrakt:**
* HTTP metoda: POST
* Endpoint: `/api/planner`
* Požadovaná vstupní data: Přidat `difficulty` (str: "EASY", "MEDIUM", "HARD"), `participants_count` (int), `has_children` (bool).
* Struktura odpovědi: Beze změny.

**Kritéria dokončení:** Pokud je nastaveno `has_children=true`, plánovač preferuje místa s atributem family_friendly.

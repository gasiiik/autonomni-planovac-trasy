# Naplánuj to – plánovač výletů a dovolené po Karlovarském kraji

Naplánuj to z otevřených dat Karlovarského kraje sestaví výlet nebo celou dovolenou na míru. Uživatel zadá, kolik má času, odkud vyráží, čím se přepravuje a co ho baví, a dostane hotový harmonogram: zastávky v pořadí, časy přesunů, mapu, navigaci, počasí a u dovolené i ubytování. Plánovač přitom hlídá otevírací dobu, sezónu, vstupné, rozpočet, děti i déšť.

## Problém → uživatel → data → funkce → přínos

| | |
|---|---|
| **Problém** | Informace o turistických cílech kraje jsou roztroušené po desítkách webů. Naplánovat den nebo dovolenou znamená zjišťovat, co je kde, kdy má otevřeno, kolik stojí a jak se mezi místy dostat. Návštěvníci proto končí na pár nejznámějších místech a menší památky a obce zůstávají stranou. |
| **Uživatel** | Turisté a návštěvníci kraje, místní a rodiny s dětmi, kteří hledají, kam vyrazit. Nepřímo kraj, obce a turistická informační centra. |
| **Data** | 23 datových sad z [DataZápadu](https://www.datazapad.cz/) – 462 turistických cílů (zámky, hrady, muzea, prameny, rozhledny, příroda, ZOO, aquaparky, lyžování, golf…). Doplněné o předpověď počasí, fotky, ubytování a mapové podklady (viz [Použitá data](#použitá-data)). |
| **Funkce** | Plánovač jednodenního výletu a vícedenní dovolené přes více obcí, mapa všech míst s filtry, detail místa, kalendář akcí kraje, navigace do Google Maps / Mapy.cz / Apple Map, sdílení a export do kalendáře. |
| **Přínos** | Uživatel ušetří čas a objeví i méně známá místa. Kraj a obce získají nástroj, který rozkládá návštěvnost po celém kraji a dá se nabízet v informačních centrech. |

### Přínos pro kraj a veřejnou správu
- **Propagace méně známých míst** – plánovač nenabízí jen „top 10“, ale i menší muzea, zříceniny, prameny a obce v okolí. Pomáhá rozložit turisty mimo nejvytíženější lokality.
- **Nástroj pro informační centra** – pracovník infocentra může návštěvníkovi během minuty sestavit plán dne nebo pobytu a poslat mu ho odkazem.
- **Hodnota otevřených dat** – ukazuje, že data, která kraj zveřejňuje (DataZápad), jdou proměnit v praktickou službu pro občany a návštěvníky.
- **Možný další rozvoj** *(zatím není součástí prototypu)*: anonymní přehled, která místa lidé plánují nejčastěji – podklad pro kraj, kam směřovat propagaci nebo investice.

## Funkce

- **Výlet na den:** průvodce o 6 krocích (čas, výchozí místo a doprava, zájmy, jídlo, rozpočet a preference, shrnutí) s animovaným ukazatelem kroků (autíčko).
- **Výchozí místo zadáte adresou** (našeptávání během psaní, omezené na Karlovarský kraj, řazené podle blízkosti) nebo tlačítkem **Moje poloha** (GPS, k poloze se dohledá adresa). Výběr obce se nepoužívá.
- **Doprava:** auto, kolo, pěšky. U pěší chůze jde zapnout **bezbariérovou variantu** (kočárek, vozík): pomalejší tempo, bez schodů a stoupání, bez rozhleden, hradů a lanovek.
- **Okruh nebo jednosměrně:** u okruhu poslední úsek vždy končí ve výchozím bodě a návrat se počítá do času i kilometrů.
- **Reálný harmonogram:** mezi zastávkami je doba přesunu podle dopravy plus **časová rezerva** (auto 5 min, kolo 3, pěšky 2; parkování, zorientování). Když dorazíte před začátkem prohlídky, plán ukáže **čekání** („Na místě budete čekat X minut před začátkem prohlídky.“) a odchod počítá až od konce prohlídky.
- **Pořadí zastávek** se optimalizuje (nejkratší čas cesty a čekání při dodržení otevíracích dob), aby se trasa nevracela sem a tam.
- **Dovolená** na více dní a obcí (stejný průvodce o 6 krocích), ubytování, jedna přehledná mapa se všemi dny (vybraný den očíslovaný, ostatní zeslabené).
- **Mapa trasy po skutečných cestách**, navigace do Google Maps, Mapy.cz a Apple Map, export do kalendáře, tisk a sdílení.
- **Ceny jsou jen vstupné** (jídlo, doprava a ubytování se nepočítají).
- **Účty** (dobrovolné): oblíbená místa a „Moje výlety“ na všech zařízeních. Již proběhlé výlety jdou zobrazit (štítek „Proběhlo“).
- Mapa všech míst s filtry, detail místa, kalendář akcí kraje.

## Jak to funguje

1. **Import dat** – skript [`import_datazapad.py`](backend/engine/scripts/import_datazapad.py) stáhne datové sady z DataZápadu přes ArcGIS REST API a převede je na místa pro plánovač. Data nejen přebírá, ale **odvozuje z nich**, co plánovač potřebuje: **přístupnost** (nepřístupné objekty vynechá, zavřené zámky a kostely nabídne jen jako krátkou zastávku zvenku), **vstupné**, **otevírací dobu** a **sezónu** z textových poznámek, **místa uvnitř** pro deštivé dny. Místo uvedené ve více sadách (např. klášter Teplá v NKP i v náboženských památkách) uloží jen jednou. Import se spouští automaticky a opakovaně – data se aktualizují a záznamy, které z DataZápadu zmizely, se smažou.
2. **Plánovač** ([`main.py`](backend/engine/app/main.py)) skládá trasu od výchozího bodu: vybírá vhodná místa v dosahu zvolené dopravy, počká na otevření, po každém přesunu přidá časovou rezervu, oběd naplánuje mezi 11:30 a 14:00, nedá víc než 3 místa stejného typu za den, u okruhu hlídá čas na návrat a podle hodinové předpovědi (Open-Meteo) upozorní na déšť nebo na přání nabídne jen místa uvnitř. Vybrané zastávky pak seřadí tak, aby byl součet cesty a čekání co nejkratší. Když výlet nejde naplánovat, vysvětlí proč.
3. **Plánovač dovolené** rozdělí dny mezi vybrané obce (víc obcí než dní = výlet přes víc měst za den), každý den naplánuje okruh z ubytování bez opakování míst, a když v obci program dojde, přidá okolní obce. U každé obce nabídne ubytování z OpenStreetMap.
4. **Frontend** (React) provede uživatele průvodcem pro výlet nebo dovolenou, případně nabídne hotový tematický výlet. Výsledek ukazuje časovou osu s fotkami, adresami a počasím, mapu trasy, navigaci a u každé zastávky **datovou sadu DataZápadu, ze které pochází**.

```
frontend (React, :5173) → PHP gateway (:8080) → Python engine (FastAPI, :8000) → MariaDB
                                                       ↑
                     import_datazapad.py ← DataZápad (ArcGIS REST API)
                     import_ubytovani.py, import_restaurace.py ← OpenStreetMap (Overpass API)
```

## Použitá data

**Jádrem aplikace jsou data DataZápadu** – všechna místa, ze kterých plánovač skládá výlety (462 z 473), pocházejí z následujících sad. Ostatní zdroje (níže) je jen doplňují. Všechny sady pocházejí z [Katalogu otevřených dat Karlovarského kraje – DataZápad](https://www.datazapad.cz/search?collection=dataset&layout=grid). Data jsme upravili: převedli na jednotný formát, vyřadili nepřístupná místa, sloučili duplicity a z textových polí odvodili otevírací dobu, sezónu a vstupné. Počty udávají místa, která po zpracování používá plánovač.

| Datová sada | Míst | Licence |
|---|---:|---|
| [Zámky v Karlovarském kraji](https://www.datazapad.cz/datasets/464108d64a93430083119bfb0845af3c) | 24 | CC BY 4.0 (upraveno) |
| [Hrady a jejich zříceniny v Karlovarském kraji](https://www.datazapad.cz/datasets/c3a42c283f0649248326a0bbd7dc5cc3) | 19 | CC BY 4.0 (upraveno) |
| [Muzea a galerie v Karlovarském kraji](https://www.datazapad.cz/datasets/5aa3b9fe8da6474786ff2b9c81b006cb) | 58 | CC BY 4.0 (upraveno) |
| [Muzea v přírodě a skanzeny v Karlovarském kraji](https://www.datazapad.cz/datasets/6be3423787fd4c1fa19a70b025e2eb64) | 4 | CC BY 4.0 (upraveno) |
| [Národní kulturní památky v Karlovarském kraji](https://www.datazapad.cz/datasets/c0ae279455b34b5fb4a929ef98675a5b) | 8 | CC0 1.0 |
| [Památky UNESCO v Karlovarském kraji](https://www.datazapad.cz/datasets/135900efd11e4df1865987b57428eb9f) | 0* | CC BY 4.0 (upraveno) |
| [Náboženské památky v Karlovarském kraji](https://www.datazapad.cz/datasets/2c9bd5558c4a495c8424a84bc6b370e2) | 20 | CC BY 4.0 (upraveno) |
| [Hornické a technické památky v Karlovarském kraji](https://www.datazapad.cz/datasets/3727aefc159e47fd8cb9d70432ab7397) | 14 | CC BY 4.0 (upraveno) |
| [Přístupné prameny v Karlovarském kraji](https://www.datazapad.cz/datasets/92327bf761e14d3c8cd169b7d65fa418) | 118 | CC BY 4.0 (upraveno) |
| [Rozhledny v Karlovarském kraji](https://www.datazapad.cz/datasets/2fe4d27ac10341f6bd2b4ea6380a2599) | 23 | CC BY 4.0 (upraveno) |
| [Jiné atraktivity v Karlovarském kraji](https://www.datazapad.cz/datasets/1e64adf22f8448a693f638c9f1334dc9) | 11 | CC BY 4.0 (upraveno) |
| [ZOO a zooparky v Karlovarském kraji](https://www.datazapad.cz/datasets/52658b60dacf474f80cf5bb7c8004cc6) | 9 | CC BY 4.0 (upraveno) |
| [Lanová a zábavní centra v Karlovarském kraji](https://www.datazapad.cz/datasets/90441fa783444e1ead5ad71464504d6a) | 20 | CC BY 4.0 (upraveno) |
| [Aquaparky, koupaliště a bazény v Karlovarském kraji](https://www.datazapad.cz/datasets/98d26c1b1c8f4bd49850af82a19a7f58) | 25 | CC BY 4.0 (upraveno) |
| [Solné jeskyně v Karlovarském kraji](https://www.datazapad.cz/datasets/197c67d6a8604a78a57335fcabe4b4d2) | 11 | CC0 1.0 |
| [Agroturistické destinace v Karlovarském kraji](https://www.datazapad.cz/datasets/5e900a28dedd446aa8ae18d49ac88d70) | 22 | CC BY 4.0 (upraveno) |
| [Přírodní pozoruhodnosti v Karlovarském kraji](https://www.datazapad.cz/datasets/037f7b55d2d34fa88fd63bf2d2903839) | 16 | CC BY 4.0 (upraveno) |
| [Botanické zahrady a arboreta v Karlovarském kraji](https://www.datazapad.cz/datasets/8ae1f28fc17f4918a0dba74bb11797ff) | 4 | CC BY 4.0 (upraveno) |
| [Pivovarnictví v Karlovarském kraji](https://www.datazapad.cz/datasets/0ddb05a36f0c4b319975df6a4b1ed90e) | 13 | CC BY 4.0 (upraveno) |
| [Golfová hřiště v Karlovarském kraji](https://www.datazapad.cz/datasets/58bc30d273d84926bc4e817aabca9321) | 9 | CC BY 4.0 (upraveno) |
| [Jezdecké oddíly a kluby v Karlovarském kraji](https://www.datazapad.cz/datasets/4cc176ac502245ab8b6f40c425bb67b9) | 7 | CC BY 4.0 (upraveno) |
| [Lyžařské vleky a lanovky v Karlovarském kraji](https://www.datazapad.cz/datasets/d130e2d3a13d4ca39b16761d2131619b) | 16 | CC BY 4.0 (upraveno) |
| [Vojenské a pietní památky v Karlovarském kraji](https://www.datazapad.cz/datasets/142875a7b4ba49769393c8a3b80cca6d) | 11 | CC BY 4.0 (upraveno) |

\* Sada UNESCO obsahuje hlavně celoplošné položky (lázeňská města, hornická krajina, geopark), které nejsou zastávkou na trase. Jediný bodový objekt (Kynžvartská daguerrotypie) se sloučil se záznamem Zámku Kynžvart.

**Doplňkové zdroje** (DataZápad je nemá, plánovač je jen doplňují):
- Restaurace, kavárny a hospody pro zastávku na oběd: [OpenStreetMap](https://www.openstreetmap.org/copyright), ODbL – DataZápad z gastronomie obsahuje jen pivovary. Podniky jsou uložené zvlášť (ne mezi turistickými cíli), plánovač čte jejich otevírací dobu podle dne v týdnu a vynechává kavárny čerpacích stanic. Na mapě míst jsou jako vypínatelná vrstva.
- Ubytování pro plánovač dovolené: [OpenStreetMap](https://www.openstreetmap.org/copyright) přes Overpass API, ODbL – hotely, penziony, apartmány, chaty a kempy (DataZápad obsahuje o ubytování jen souhrnné statistiky).
- Předpověď počasí: [Open-Meteo](https://open-meteo.com/), CC BY 4.0.
- Trasa na mapě po silnicích, cyklostezkách a cestách: [OSRM](https://project-osrm.org/) nad OpenStreetMap ([routing.openstreetmap.de](https://routing.openstreetmap.de/about.html), FOSSGIS); bezbariérová chůze přes [Valhalla](https://valhalla.openstreetmap.de/) (profil wheelchair). Dotazy jdou přes náš server (`/api/route`), který si trasy pamatuje a hlídá limity veřejných služeb. Když služba neodpoví, zobrazí se trasa vzdušnou čarou.
- Vyhledávání adres výchozího místa: [Photon](https://photon.komoot.io/) a záložně [Nominatim](https://nominatim.org/) nad daty OpenStreetMap, ODbL (`/api/geocode`, `/api/reverse`). Otevírací dobu restaurací a kaváren bere plánovač z tagu `opening_hours` v OpenStreetMap; u míst z DataZápadu se čte z textu v datech, a když tam není, použije se typická doba podle druhu místa.
- Fotky míst: [Wikipedie](https://cs.wikipedia.org/), [Wikimedia Commons](https://commons.wikimedia.org/) a [Wikidata](https://www.wikidata.org/) – odkazujeme na náhledy, licence podle jednotlivých souborů (většinou CC BY-SA). Fotka se přiřadí jen při shodě názvu a polohy. Když tam fotka není, použije se náhledový obrázek z oficiálního webu místa uvedeného v DataZápadu – patří provozovateli webu a u fotky je uveden zdroj. Fotky prohlížeč stahuje přes náš server (`/photos`), který si je jednou uloží – Wikimedia při mnoha obrázcích najednou odpovídá 429 a fotky by se náhodně nenačítaly.
- Kalendář akcí: odkazy do oficiálního kalendáře kraje [Kam na západě](https://kamnazapade.cz/) – data nepřebíráme, jen na kalendář odkazujeme.
- Mapové podklady: © přispěvatelé [OpenStreetMap](https://www.openstreetmap.org/copyright), ODbL.

## Použití AI

- **Claude Code (Anthropic)** – návrh a implementace importu DataZápadu (čtení přístupnosti, vstupného, otevírací doby a sezóny z dat, slučování duplicit, dohledávání fotek), importu ubytování z OpenStreetMap, plánovače dovolené, napojení React frontendu na backend, map a navigace, revize kódu a opravy chyb v plánovači. Výstupy AI tým kontroloval a testoval.

## Spuštění

Potřebujete [Docker](https://www.docker.com/) s Docker Compose.

V hlavní složce projektu (potřeba je jen Docker Desktop):
```bash
docker compose up -d --build
```
Web: http://localhost:5173, API: http://localhost:8080/api. Při prvním spuštění se databáze zakládá asi půl minuty – brána a engine na ni počkají (`docker compose ps` ukáže `db ... (healthy)`).

Když něco nejde: `docker compose ps` (běží všechny 4 kontejnery?) a `docker compose logs db` / `docker compose logs php_gateway`. Starou databázi z dřívější verze smaže `docker compose down -v` (data se pak stáhnou znovu).

Data z DataZápadu i ubytování a restaurace z OpenStreetMap se stáhnou **automaticky** při startu enginu – při prvním spuštění (cca 10 minut včetně fotek) a pak vždy, když jsou starší než 7 dní (`AUTO_IMPORT_MAX_AGE_DAYS` v `docker-compose.yml`, vypnutí `AUTO_IMPORT=0`). Aplikace mezitím běží, průběh uvidíte v `docker compose logs -f python_engine`.

Ruční spuštění importu:
```bash
docker exec backend-python_engine-1 python scripts/import_datazapad.py
```

Aplikace pak běží na:
- **http://localhost:5173** – webová aplikace
- http://localhost:8080/api – API (PHP gateway)
- http://localhost:8000/docs – dokumentace plánovacího enginu

Volby importu:
- `--no-images` – bez dohledávání fotek (rychlé, dříve nalezené fotky zůstanou)
- `--dry-run` – jen vypíše, co by se importovalo, do databáze nesahá

Vývoj frontendu bez Dockeru: `cd frontend && npm install && npm run dev`.

**Po `git pull` vždy znovu sestavte obrazy:** `docker compose up -d --build`. Frontend (včetně loga a obrázků ve `frontend/public`) se do obrazu zapéká při sestavení, bez `--build` poběží stará verze. V prohlížeči pak obnovte stránku bez cache (Ctrl+F5), loga a favicon se cachují.

Hesla k databázi jsou zatím uvedena přímo v `docker-compose.yml` a slouží jen pro lokální vývoj. Skutečné klíče a hesla do repozitáře nepatří, použijte `.env.example`.

## Tým
- Oleksandr Kerestii ([@oleksandr106](https://github.com/oleksandr106)) – developer
- Lukáš Nováček – developer
- Jara Bouška – developer

## Licence
Kód: [MIT](LICENSE). Ostatní obsah: CC BY 4.0.

---
Prototyp z Hackathonu otevřených dat Karlovarského kraje 2026. Není oficiální službou Karlovarského kraje ani KIC KK.

# KrušnoPlán – plánovač výletů po Karlovarském kraji

KrušnoPlán sestaví celodenní výlet na míru: zadáte datum, časové okno, výchozí obec, způsob dopravy a co vás zajímá, a aplikace naplánuje trasu se zastávkami a přesným harmonogramem. Plánovač pracuje s otevřenými daty Karlovarského kraje z DataZápadu (přes 400 turistických cílů) a hlídá otevírací dobu, sezónu, vstupné, rozpočet i předpověď počasí. Pomáhá turistům i místním objevit i méně známá místa bez dlouhého hledání.

## Jak to funguje

1. **Import dat** – skript [`import_datazapad.py`](backend/engine/scripts/import_datazapad.py) stáhne datové sady z DataZápadu přes ArcGIS REST API a převede je na místa pro plánovač. Z dat čte polohu, popis, adresu, web, **přístupnost** (nepřístupné objekty vynechá, zavřené zámky a kostely nabídne jen jako krátkou zastávku zvenku), **vstupné**, **otevírací dobu** a **sezónu** (koupaliště, lanová centra, rozhledny). Místo uvedené ve více sadách (např. klášter Teplá v NKP i v náboženských památkách) uloží jen jednou. Import lze spouštět opakovaně – data se aktualizují a záznamy, které z DataZápadu zmizely, se smažou.
2. **Plánovač** ([`main.py`](backend/engine/app/main.py)) skládá trasu od výchozího bodu: vybírá nejbližší vhodné místo, počká na otevření (max. 60 min), oběd naplánuje mezi 11:30 a 14:00, nedá víc než 3 místa stejného typu za den, u okruhu hlídá čas na návrat a při dešti (předpověď Open-Meteo) upřednostní vnitřní aktivity. Když výlet nejde naplánovat, vysvětlí proč.
3. **Frontend** (React) provede uživatele průvodcem nebo nabídne tematický výlet na jedno kliknutí. Výsledek zobrazí jako časovou osu s fotkami, adresami, předpovědí počasí u každé zastávky a mapou trasy; plán jde sdílet odkazem, uložit do kalendáře (.ics) nebo vytisknout a ke každé zastávce otevřít navigaci v Mapy.cz. **Mapa míst** ukazuje všechna místa z dat s filtry a každé místo má vlastní stránku s detailem. U každé zastávky uvádí datovou sadu DataZápadu, ze které pochází, a stránka **O datech** ukazuje, kolik míst z které sady aplikace používá a kdy proběhla poslední aktualizace.

```
frontend (React, :5173) → PHP gateway (:8080) → Python engine (FastAPI, :8000) → MariaDB
                                                       ↑
                                    import_datazapad.py ← DataZápad (ArcGIS REST API)
```

## Použitá data

Všechny sady pocházejí z [Katalogu otevřených dat Karlovarského kraje – DataZápad](https://www.datazapad.cz/search?collection=dataset&layout=grid). Data jsme upravili: převedli na jednotný formát, vyřadili nepřístupná místa, sloučili duplicity a z textových polí odvodili otevírací dobu, sezónu a vstupné. Počty udávají místa, která po zpracování používá plánovač.

| Datová sada | Míst | Licence |
|---|---:|---|
| [Zámky v Karlovarském kraji](https://www.datazapad.cz/datasets/464108d64a93430083119bfb0845af3c) | 24 | CC BY 4.0 (upraveno) |
| [Hrady a jejich zříceniny v Karlovarském kraji](https://www.datazapad.cz/datasets/c3a42c283f0649248326a0bbd7dc5cc3) | 20 | CC BY 4.0 (upraveno) |
| [Muzea a galerie v Karlovarském kraji](https://www.datazapad.cz/datasets/5aa3b9fe8da6474786ff2b9c81b006cb) | 58 | CC BY 4.0 (upraveno) |
| [Muzea v přírodě a skanzeny v Karlovarském kraji](https://www.datazapad.cz/datasets/6be3423787fd4c1fa19a70b025e2eb64) | 4 | CC BY 4.0 (upraveno) |
| [Národní kulturní památky v Karlovarském kraji](https://www.datazapad.cz/datasets/c0ae279455b34b5fb4a929ef98675a5b) | 10 | CC0 1.0 |
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
| [Agroturistické destinace v Karlovarském kraji](https://www.datazapad.cz/datasets/5e900a28dedd446aa8ae18d49ac88d70) | 23 | CC BY 4.0 (upraveno) |
| [Přírodní pozoruhodnosti v Karlovarském kraji](https://www.datazapad.cz/datasets/037f7b55d2d34fa88fd63bf2d2903839) | 16 | CC BY 4.0 (upraveno) |
| [Botanické zahrady a arboreta v Karlovarském kraji](https://www.datazapad.cz/datasets/8ae1f28fc17f4918a0dba74bb11797ff) | 4 | CC BY 4.0 (upraveno) |
| [Pivovarnictví v Karlovarském kraji](https://www.datazapad.cz/datasets/0ddb05a36f0c4b319975df6a4b1ed90e) | 13 | CC BY 4.0 (upraveno) |

\* Sada UNESCO obsahuje hlavně celoplošné položky (lázeňská města, hornická krajina, geopark), které nejsou zastávkou na trase. Jediný bodový objekt (Kynžvartská daguerrotypie) se sloučil se záznamem Zámku Kynžvart.

**Další zdroje:**
- Předpověď počasí: [Open-Meteo](https://open-meteo.com/), CC BY 4.0
- Fotky míst: [Wikipedie](https://cs.wikipedia.org/) a [Wikimedia Commons](https://commons.wikimedia.org/) – odkazujeme na náhledy, licence podle jednotlivých souborů (většinou CC BY-SA). Fotka se přiřadí jen při shodě názvu a polohy. Když tam fotka není, použije se náhledový obrázek (og:image) z oficiálního webu místa uvedeného v DataZápadu – patří provozovateli webu a u fotky je uveden zdroj.
- Mapové podklady: © přispěvatelé [OpenStreetMap](https://www.openstreetmap.org/copyright), ODbL

## Použití AI

- **Claude Code (Anthropic)** – návrh a implementace importu DataZápadu (čtení přístupnosti, vstupného, otevírací doby a sezóny z dat, slučování duplicit, dohledávání fotek), napojení React frontendu na backend, mapa trasy, revize kódu a opravy chyb v plánovači (časové pásmo, čekání na otevření, rozmanitost zastávek, plánování při dešti).

## Spuštění

Potřebujete [Docker](https://www.docker.com/) s Docker Compose.

```bash
cd backend
docker compose up -d --build
```

Data z DataZápadu se stáhnou **automaticky** při startu enginu – při prvním spuštění (cca 10 minut včetně fotek) a pak vždy, když jsou starší než 7 dní (`AUTO_IMPORT_MAX_AGE_DAYS` v `docker-compose.yml`, vypnutí `AUTO_IMPORT=0`). Aplikace mezitím běží, průběh uvidíte v `docker compose logs -f python_engine` a na stránce **O datech**.

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

Hesla k databázi jsou zatím uvedena přímo v `docker-compose.yml` a slouží jen pro lokální vývoj. Skutečné klíče a hesla do repozitáře nepatří, použijte `.env.example`.

## Tým
- <Jméno Příjmení> (@[login]) – [role]

## Licence
Kód: [MIT](LICENSE). Ostatní obsah: CC BY 4.0.

---
Prototyp z Hackathonu otevřených dat Karlovarského kraje 2026. Není oficiální službou Karlovarského kraje ani KIC KK.

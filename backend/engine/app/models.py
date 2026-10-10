from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text, DateTime
from sqlalchemy.orm import relationship
from .database import Base

class Location(Base):
    __tablename__ = "locations"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), index=True)
    lat = Column(Float)
    lng = Column(Float)

class ActivityPOI(Base):
    __tablename__ = "activity_pois"
    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(Integer, ForeignKey("locations.id"))
    name = Column(String(200))
    description = Column(Text)
    category = Column(String(50))
    est_duration_mins = Column(Integer)
    lat = Column(Float)
    lng = Column(Float)
    image_url = Column(Text)
    open_time = Column(String(5), default="09:00") # stejné výchozí hodnoty jako v init.sql
    close_time = Column(String(5), default="18:00")
    
    # NOVÉ POLOŽKY PRO SOČ:
    price_estimated = Column(Float, default=0.0) # 0 znamená zdarma
    tags = Column(String(255), default="") # např. "CAFE,VEGETARIAN"
    family_friendly = Column(Integer, default=1) # 1 = ano (Boolean je v MySQL jako TinyInt)
    difficulty_level = Column(String(20), default="EASY") # "EASY", "MEDIUM", "HARD"

    # NAPOJENÍ NA DATAZÁPAD (Open Data Karlovarského kraje):
    source = Column(String(30), default="MANUAL") # MANUAL / DATAZAPAD
    external_id = Column(String(150), index=True) # např. "Zámky_v_Karlovarském_kraji_WFL1:12" - umožní opakovaný import bez duplicit
    website = Column(String(255))
    indoor = Column(Integer, default=0) # 1 = vnitřní aktivita (vhodná při dešti)
    address = Column(String(255))
    season_from = Column(Integer) # měsíc 1-12, od kdy má místo sezónu (NULL = celoročně)
    season_to = Column(Integer)   # měsíc 1-12, do kdy (může přetéct přes Nový rok, např. 11 -> 3)
    
    location = relationship("Location")


class Accommodation(Base):
    """Ubytování z OpenStreetMap (hotely, penziony, apartmány, chaty, kempy) - pro plánování dovolené."""
    __tablename__ = "accommodations"
    id = Column(Integer, primary_key=True, index=True)
    osm_id = Column(String(40), unique=True) # např. "node/123456" - opakovaný import bez duplicit
    name = Column(String(200))
    kind = Column(String(20))                # hotel, guest_house, apartment, chalet, hostel, motel, camp_site
    lat = Column(Float)
    lng = Column(Float)
    stars = Column(Integer)
    website = Column(String(255))
    phone = Column(String(50))
    address = Column(String(255))


class Restaurant(Base):
    """Restaurace, kavárny a hospody z OpenStreetMap - jen pro zastávku na jídlo (DataZápad má jen pivovary)."""
    __tablename__ = "restaurants"
    id = Column(Integer, primary_key=True, index=True)
    osm_id = Column(String(40), unique=True)
    name = Column(String(200))
    kind = Column(String(20))                # restaurant, cafe, pub, biergarten
    lat = Column(Float)
    lng = Column(Float)
    cuisine = Column(String(100))
    opening_hours = Column(String(255))      # původní zápis z OpenStreetMap
    website = Column(String(255))
    address = Column(String(255))
    vegetarian = Column(Integer, default=0)


class Dataset(Base):
    """Metadata datové sady z DataZápad - pro uvedení zdroje u míst a počítadlo dat."""
    __tablename__ = "datasets"
    service = Column(String(150), primary_key=True) # název ArcGIS služby = prefix ActivityPOI.external_id
    title = Column(String(255))
    item_id = Column(String(64))
    url = Column(String(255)) # stránka datové sady na datazapad.cz
    license = Column(String(50))
    records_total = Column(Integer) # záznamů v datové sadě
    places_used = Column(Integer)   # míst, která po zpracování používá plánovač
    imported_at = Column(DateTime)

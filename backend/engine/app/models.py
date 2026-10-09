from sqlalchemy import Column, Integer, String, Float, ForeignKey, Text
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

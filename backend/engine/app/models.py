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
    image_url = Column(String(255))
    open_time = Column(String(5), default="00:00") # např. "09:00"
    close_time = Column(String(5), default="23:59") # např. "17:00"
    
    location = relationship("Location")

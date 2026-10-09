import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Spojení na MariaDB z proměnné prostředí
DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://api_user:api_password@db/krusnoplan")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

import os
from sqlalchemy import create_engine, text
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


def ensure_planner_columns():
    """Upgrade existing MariaDB installations without requiring a data reset."""
    with engine.begin() as connection:
        connection.execute(text(
            "ALTER TABLE activity_pois "
            "ADD COLUMN IF NOT EXISTS opening_hours_json TEXT NULL"
        ))
        connection.execute(text(
            "ALTER TABLE activity_pois "
            "ADD COLUMN IF NOT EXISTS tour_slots_json TEXT NULL"
        ))

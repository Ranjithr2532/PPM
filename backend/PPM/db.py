import os
from dotenv import load_dotenv

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

import psycopg2.extensions

# Register safe psycopg2 typecaster for PostgreSQL DATE (OID 1082)
# Prevents 'ValueError: year -1 is out of range' when DB contains BC or invalid dates
def cast_date_safe(value, cursor):
    if value is None:
        return None
    if 'BC' in value or value.startswith('-') or value.startswith('0000'):
        return None
    try:
        return psycopg2.extensions.DATE(value, cursor)
    except Exception:
        return None

try:
    SAFE_DATE = psycopg2.extensions.new_type((1082,), "SAFE_DATE", cast_date_safe)
    psycopg2.extensions.register_type(SAFE_DATE)
except Exception:
    pass

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set in .env")

engine = create_engine(DATABASE_URL, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


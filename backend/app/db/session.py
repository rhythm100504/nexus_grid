from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv
from sqlalchemy.pool import NullPool

if os.getenv("VERCEL") != "1":
    load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg2://energy_user:energy_password@localhost:5432/energy_db")

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

on_vercel = os.getenv("VERCEL") == "1"
if on_vercel and not os.getenv("DATABASE_URL"):
    raise RuntimeError("Set DATABASE_URL to a hosted PostgreSQL connection string in Vercel.")
if on_vercel and DATABASE_URL.startswith("sqlite:"):
    raise RuntimeError("Vercel requires a hosted database; SQLite files are not persistent.")

engine_options = {"pool_pre_ping": True}
if DATABASE_URL.startswith("sqlite:"):
    engine_options["connect_args"] = {"check_same_thread": False}
elif on_vercel:
    # Use the database provider's pooled URL; don't retain idle local connections.
    engine_options["poolclass"] = NullPool
    engine_options["connect_args"] = {"connect_timeout": 10}

engine = create_engine(DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

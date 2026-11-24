"""Database connection and shared helpers for the Factory App."""
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# Workspaces keep demo data separate from real factory data.
REAL = "real"
DEMO = "demo"
WORKSPACES = (REAL, DEMO)

# Metal contexts
SILVER = "silver"
GOLD = "gold"
METALS = (SILVER, GOLD)


def new_id() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def clean(doc: dict | None) -> dict | None:
    """Drop Mongo's _id so documents serialize cleanly."""
    if doc is None:
        return None
    doc.pop("_id", None)
    return doc


def history_entry(user: dict, action: str, detail: str = "") -> dict:
    """A single audit-trail entry recording who did what and when."""
    return {
        "action": action,
        "detail": detail,
        "by_id": user.get("id") if user else None,
        "by_name": user.get("name") if user else "system",
        "by_role": user.get("role") if user else "system",
        "at": now_iso(),
    }

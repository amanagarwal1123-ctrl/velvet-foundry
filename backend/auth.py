"""Authentication: fixed admin email/password + one-time codes for staff."""
import os
import random
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext
from pydantic import BaseModel
from pymongo import ReturnDocument

from db import clean, db, new_id, now_iso

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
JWT_SECRET = os.environ.get("JWT_SECRET", "factory-app-dev-secret")
JWT_ALG = "HS256"
TOKEN_TTL_HOURS = 12

ADMIN_EMAIL = "admin@gmail.com"
ADMIN_PASSWORD = "1803"

# Roles that can sign in
ROLE_ADMIN = "admin"
ROLE_MANAGER = "manager"
ROLE_ASSISTANT = "assistant"
ROLE_ACCOUNTANT = "accountant"
LOGIN_ROLES = (ROLE_ADMIN, ROLE_MANAGER, ROLE_ASSISTANT, ROLE_ACCOUNTANT)

# Who may issue codes for whom
ISSUABLE = {
    ROLE_ADMIN: [ROLE_MANAGER],
    ROLE_MANAGER: [ROLE_ASSISTANT, ROLE_ACCOUNTANT],
}

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer(auto_error=False)
router = APIRouter(prefix="/api/auth", tags=["auth"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def hash_password(raw: str) -> str:
    return pwd_context.hash(raw)


def verify_password(raw: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(raw, hashed)
    except Exception:
        return False


def make_token(user: dict) -> str:
    payload = {
        "sub": user["id"],
        "role": user["role"],
        "name": user["name"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_TTL_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def seed_admin() -> None:
    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if not existing:
        await db.users.insert_one(
            {
                "id": new_id(),
                "name": "Admin",
                "email": ADMIN_EMAIL,
                "role": ROLE_ADMIN,
                "password_hash": hash_password(ADMIN_PASSWORD),
                "created_at": now_iso(),
                "created_by": None,
            }
        )


def gen_code() -> str:
    return f"{random.randint(0, 999999):06d}"


async def unique_code() -> str:
    for _ in range(50):
        code = gen_code()
        if not await db.access_codes.find_one({"code": code, "used": False}):
            return code
    return gen_code()


# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------
async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> dict:
    if creds is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload.get("sub")})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return clean(user)


def require_roles(*roles):
    async def checker(user: dict = Depends(get_current_user)) -> dict:
        if roles and user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Not permitted for your role")
        return user

    return checker


def public_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "name": user["name"],
        "role": user["role"],
        "email": user.get("email"),
    }


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class AdminLogin(BaseModel):
    email: str
    password: str


class CodeLogin(BaseModel):
    code: str


class CreateCode(BaseModel):
    name: Optional[str] = None
    role: str
    staff_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@router.post("/login")
async def admin_login(body: AdminLogin):
    user = await db.users.find_one({"email": body.email.strip().lower()})
    if not user or not user.get("password_hash") or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user = clean(user)
    return {"token": make_token(user), "user": public_user(user)}


@router.post("/code-login")
async def code_login(body: CodeLogin):
    # Atomic single-use redemption: claim the code and user together.
    code_doc = await db.access_codes.find_one_and_update(
        {"code": body.code.strip(), "used": False},
        {"$set": {"used": True, "used_at": now_iso()}},
        return_document=ReturnDocument.AFTER,
    )
    if not code_doc:
        raise HTTPException(status_code=401, detail="Invalid or already-used code")
    user = await db.users.find_one({"id": code_doc["user_id"]})
    if not user:
        raise HTTPException(status_code=401, detail="Linked user missing")
    user = clean(user)
    return {"token": make_token(user), "user": public_user(user)}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return {"user": public_user(user)}


@router.get("/issuable-roles")
async def issuable_roles(user: dict = Depends(get_current_user)):
    return {"roles": ISSUABLE.get(user["role"], [])}


# --- Access code management (supervisor dashboard) ---
codes_router = APIRouter(prefix="/api/codes", tags=["codes"])


@codes_router.post("")
async def create_code(body: CreateCode, user: dict = Depends(get_current_user)):
    target_role = body.role.strip().lower()
    allowed = ISSUABLE.get(user["role"], [])
    if target_role not in allowed:
        raise HTTPException(status_code=403, detail="You cannot issue a code for this role")

    # Stable staff identity: reuse an explicitly-chosen staff record, otherwise
    # ALWAYS create a new one. Never merge by name — two people sharing a name
    # and role keep separate records and histories.
    if body.staff_id:
        staff = await db.users.find_one({"id": body.staff_id, "role": target_role})
        if not staff:
            raise HTTPException(status_code=404, detail="Staff member not found")
        staff_id = staff["id"]
        name = staff["name"]
    else:
        name = (body.name or "").strip()
        if not name:
            raise HTTPException(status_code=400, detail="Name is required")
        staff_id = new_id()
        await db.users.insert_one(
            {
                "id": staff_id,
                "name": name,
                "email": None,
                "role": target_role,
                "password_hash": None,
                "created_at": now_iso(),
                "created_by": user["id"],
            }
        )

    code = await unique_code()
    doc = {
        "id": new_id(),
        "code": code,
        "name": name,
        "role": target_role,
        "user_id": staff_id,
        "created_by": user["id"],
        "created_by_name": user["name"],
        "used": False,
        "used_at": None,
        "created_at": now_iso(),
    }
    await db.access_codes.insert_one(doc)
    return clean(doc)


@codes_router.get("/staff")
async def list_staff(user: dict = Depends(get_current_user)):
    """Existing staff records the supervisor may re-issue a code to."""
    roles = ISSUABLE.get(user["role"], [])
    if not roles:
        return []
    return (
        await db.users.find({"role": {"$in": roles}}, {"_id": 0, "id": 1, "name": 1, "role": 1})
        .sort("name", 1)
        .to_list(500)
    )


@codes_router.get("")
async def list_codes(user: dict = Depends(get_current_user)):
    """Pending codes the current supervisor is responsible for."""
    docs = (
        await db.access_codes.find({"created_by": user["id"], "used": False}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(200)
    )
    return docs


@codes_router.delete("/{code_id}")
async def clear_code(code_id: str, user: dict = Depends(get_current_user)):
    res = await db.access_codes.delete_one({"id": code_id, "created_by": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Code not found")
    return {"ok": True}

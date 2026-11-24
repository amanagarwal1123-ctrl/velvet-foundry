"""Emergent managed object storage for user-uploaded photos."""
import logging
import os
import uuid

import requests
from fastapi import APIRouter, Depends, Header, HTTPException, Query, UploadFile, File
from fastapi.responses import Response

from auth import get_current_user
from db import db, new_id, now_iso

logger = logging.getLogger(__name__)

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "factory-app"

MIME_TYPES = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "webp": "image/webp",
    "heic": "image/heic",
    "heif": "image/heif",
}

_storage_key: str | None = None


def init_storage(force: bool = False) -> str | None:
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    if not EMERGENT_KEY:
        logger.error("EMERGENT_LLM_KEY missing; storage disabled")
        return None
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data,
            timeout=120,
        )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str) -> tuple[bytes, str]:
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


router = APIRouter(prefix="/api/files", tags=["files"])


@router.post("/upload")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "bin"
    content_type = file.content_type or MIME_TYPES.get(ext, "application/octet-stream")
    file_id = new_id()
    path = f"{APP_NAME}/uploads/{user['id']}/{file_id}.{ext}"
    data = await file.read()
    try:
        result = put_object(path, data, content_type)
    except Exception as exc:
        logger.error("upload failed: %s", exc)
        raise HTTPException(status_code=502, detail="Photo upload failed. Please try again.")

    stored_path = result.get("path", path)
    await db.files.insert_one(
        {
            "id": file_id,
            "storage_path": stored_path,
            "original_filename": file.filename,
            "content_type": content_type,
            "size": result.get("size", len(data)),
            "is_deleted": False,
            "uploaded_by": user["id"],
            "created_at": now_iso(),
        }
    )
    return {"id": file_id, "url": f"/api/files/{file_id}"}


@router.get("/{file_id}")
async def download_file(
    file_id: str,
    authorization: str = Header(None),
    auth: str = Query(None),
):
    # img tags cannot send Authorization headers, so accept ?auth= token too.
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]
    elif auth:
        token = auth
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    # Validate the token (reuse auth decode via a lightweight check).
    import jwt as _jwt

    from auth import JWT_ALG, JWT_SECRET

    try:
        _jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    record = await db.files.find_one({"id": file_id, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        data, content_type = get_object(record["storage_path"])
    except Exception as exc:
        logger.error("download failed: %s", exc)
        raise HTTPException(status_code=502, detail="Could not load photo")
    return Response(content=data, media_type=record.get("content_type", content_type))

"""Factory App — Silver & Gold Casting Workshop Manager (FastAPI backend)."""
import asyncio
import logging
from contextlib import suppress
from typing import List, Optional

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from pymongo import ASCENDING, IndexModel
from starlette.middleware.cors import CORSMiddleware

import auth
import seed as seedmod
from auth import get_current_user, require_roles, ROLE_ADMIN, ROLE_MANAGER
from db import (
    DEMO,
    METALS,
    REAL,
    SILVER,
    WORKSPACES,
    clean,
    db,
    history_entry,
    new_id,
    now_iso,
)
from domain import (
    allocate_recovery,
    compute_bag_accounting,
    compute_bag_costing,
    eligible_bags_for_recovery,
)
from storage import router as files_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Factory App")
api = APIRouter(prefix="/api")

INDEXES: dict[str, list[IndexModel]] = {
    "users": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("email", ASCENDING)], name="email")],
    "access_codes": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("code", ASCENDING), ("used", ASCENDING)], name="code_used"),
        IndexModel([("created_by", ASCENDING), ("used", ASCENDING)], name="creator_used"),
    ],
    "karigars": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("workspace", ASCENDING)], name="ws")],
    "steps": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("workspace", ASCENDING), ("order", ASCENDING)], name="ws_order")],
    "settings": [IndexModel([("workspace", ASCENDING)], name="ws", unique=True)],
    "bags": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("workspace", ASCENDING), ("metal", ASCENDING), ("status", ASCENDING)], name="ws_metal_status"),
    ],
    "packets": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("workspace", ASCENDING), ("metal", ASCENDING), ("status", ASCENDING)], name="ws_metal_status"),
        IndexModel([("composition.bag_id", ASCENDING)], name="comp_bag"),
    ],
    "movements": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("packet_id", ASCENDING)], name="packet")],
    "handovers": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("packet_id", ASCENDING)], name="packet")],
    "qc_records": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("packet_id", ASCENDING)], name="packet")],
    "stone_txns": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("bag_id", ASCENDING)], name="bag")],
    "scrap_returns": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("bag_id", ASCENDING)], name="bag")],
    "recoveries": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("workspace", ASCENDING), ("metal", ASCENDING)], name="ws_metal")],
    "expenses": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("workspace", ASCENDING), ("metal", ASCENDING)], name="ws_metal")],
    "payments": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("workspace", ASCENDING)], name="ws")],
    "deliveries": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("workspace", ASCENDING), ("metal", ASCENDING)], name="ws_metal")],
    "files": [IndexModel([("id", ASCENDING)], name="id", unique=True)],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)


# ---------------------------------------------------------------------------
# Shared validation helpers
# ---------------------------------------------------------------------------
def val_workspace(workspace: str) -> str:
    if workspace not in WORKSPACES:
        raise HTTPException(status_code=400, detail="Invalid workspace")
    return workspace


def val_metal(metal: str) -> str:
    if metal not in METALS:
        raise HTTPException(status_code=400, detail="Invalid metal")
    return metal


def scale_composition(composition: list[dict], target_metal: float) -> list[dict]:
    """Scale a packet's per-bag composition to a new total metal weight."""
    current = sum(float(c.get("metal_g", 0) or 0) for c in composition)
    if current <= 0:
        return composition
    factor = target_metal / current
    scaled = [{"bag_id": c["bag_id"], "metal_g": round(float(c["metal_g"]) * factor, 4)} for c in composition]
    diff = round(target_metal - sum(c["metal_g"] for c in scaled), 4)
    if scaled and abs(diff) >= 0.0001:
        scaled[-1]["metal_g"] = round(scaled[-1]["metal_g"] + diff, 4)
    return scaled


async def next_bag_no(workspace: str, metal: str) -> str:
    count = await db.bags.count_documents({"workspace": workspace, "metal": metal})
    prefix = "S" if metal == SILVER else "G"
    return f"{prefix}-{count + 1:04d}"


async def get_bag_or_404(bag_id: str) -> dict:
    bag = await db.bags.find_one({"id": bag_id}, {"_id": 0})
    if not bag:
        raise HTTPException(status_code=404, detail="Bag not found")
    return bag


async def get_packet_or_404(packet_id: str) -> dict:
    pkt = await db.packets.find_one({"id": packet_id}, {"_id": 0})
    if not pkt:
        raise HTTPException(status_code=404, detail="Packet not found")
    return pkt


async def labour_rate_for(workspace: str, metal: str) -> float:
    s = await db.settings.find_one({"workspace": workspace}, {"_id": 0})
    if not s:
        return 0.0
    return float(s.get("labour_rates", {}).get(metal, 0) or 0)


async def adjustment_limit_for(workspace: str) -> float:
    s = await db.settings.find_one({"workspace": workspace}, {"_id": 0})
    if not s:
        return 0.5
    return float(s.get("adjustment_limit_g", 0.5) or 0.0)


# ===========================================================================
# Health
# ===========================================================================
@api.get("/")
async def root():
    return {"message": "Factory App API", "status": "ok"}


# ===========================================================================
# Steps (configurable production steps)
# ===========================================================================
class StepIn(BaseModel):
    name_hi: str
    name_en: str
    is_qc: bool = False


class StepReorder(BaseModel):
    ordered_ids: List[str]


@api.get("/steps")
async def list_steps(workspace: str = Query(REAL), user: dict = Depends(get_current_user)):
    val_workspace(workspace)
    return await db.steps.find({"workspace": workspace, "active": True}, {"_id": 0}).sort("order", 1).to_list(100)


@api.post("/steps")
async def create_step(body: StepIn, workspace: str = Query(REAL), user: dict = Depends(require_roles(ROLE_ADMIN, ROLE_MANAGER))):
    val_workspace(workspace)
    count = await db.steps.count_documents({"workspace": workspace})
    doc = {
        "id": new_id(),
        "workspace": workspace,
        "name_hi": body.name_hi.strip(),
        "name_en": body.name_en.strip(),
        "is_qc": body.is_qc,
        "order": count,
        "active": True,
        "created_at": now_iso(),
    }
    await db.steps.insert_one(doc)
    return clean(doc)


@api.put("/steps/{step_id}")
async def update_step(step_id: str, body: StepIn, user: dict = Depends(require_roles(ROLE_ADMIN, ROLE_MANAGER))):
    res = await db.steps.update_one(
        {"id": step_id},
        {"$set": {"name_hi": body.name_hi.strip(), "name_en": body.name_en.strip(), "is_qc": body.is_qc}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Step not found")
    return clean(await db.steps.find_one({"id": step_id}))


@api.post("/steps/reorder")
async def reorder_steps(body: StepReorder, user: dict = Depends(require_roles(ROLE_ADMIN, ROLE_MANAGER))):
    for i, sid in enumerate(body.ordered_ids):
        await db.steps.update_one({"id": sid}, {"$set": {"order": i}})
    return {"ok": True}


@api.delete("/steps/{step_id}")
async def delete_step(step_id: str, user: dict = Depends(require_roles(ROLE_ADMIN, ROLE_MANAGER))):
    # Soft-disable so historical movements keep their reference.
    res = await db.steps.update_one({"id": step_id}, {"$set": {"active": False}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Step not found")
    return {"ok": True}


# ===========================================================================
# Karigars (worker handler names — never log in)
# ===========================================================================
class KarigarIn(BaseModel):
    name: str


@api.get("/karigars")
async def list_karigars(workspace: str = Query(REAL), metal: str = Query(...), user: dict = Depends(get_current_user)):
    val_workspace(workspace)
    val_metal(metal)
    return await db.karigars.find({"workspace": workspace, "metal": metal, "active": True}, {"_id": 0}).sort("name", 1).to_list(500)


@api.post("/karigars")
async def create_karigar(body: KarigarIn, workspace: str = Query(REAL), metal: str = Query(...), user: dict = Depends(get_current_user)):
    val_workspace(workspace)
    val_metal(metal)
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name required")
    doc = {"id": new_id(), "workspace": workspace, "metal": metal, "name": name, "active": True, "created_at": now_iso(), "created_by": user["id"]}
    await db.karigars.insert_one(doc)
    return clean(doc)


@api.put("/karigars/{karigar_id}")
async def update_karigar(karigar_id: str, body: KarigarIn, user: dict = Depends(get_current_user)):
    res = await db.karigars.update_one({"id": karigar_id}, {"$set": {"name": body.name.strip()}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Karigar not found")
    return clean(await db.karigars.find_one({"id": karigar_id}))


@api.delete("/karigars/{karigar_id}")
async def delete_karigar(karigar_id: str, user: dict = Depends(get_current_user)):
    res = await db.karigars.update_one({"id": karigar_id}, {"$set": {"active": False}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Karigar not found")
    return {"ok": True}


# ===========================================================================
# Settings (labour rates + expense categories)
# ===========================================================================
class SettingsIn(BaseModel):
    labour_rates: Optional[dict] = None
    expense_categories: Optional[List[dict]] = None
    adjustment_limit_g: Optional[float] = None


@api.get("/settings")
async def get_settings(workspace: str = Query(REAL), user: dict = Depends(get_current_user)):
    val_workspace(workspace)
    s = await db.settings.find_one({"workspace": workspace}, {"_id": 0})
    if not s:
        await seedmod.seed_settings(db, workspace)
        s = await db.settings.find_one({"workspace": workspace}, {"_id": 0})
    return s


@api.put("/settings")
async def update_settings(body: SettingsIn, workspace: str = Query(REAL), user: dict = Depends(require_roles(ROLE_ADMIN, ROLE_MANAGER))):
    val_workspace(workspace)
    update = {"updated_at": now_iso()}
    if body.labour_rates is not None:
        clean_rates = {}
        for m in METALS:
            if m in body.labour_rates:
                clean_rates[m] = float(body.labour_rates[m] or 0)
        update["labour_rates"] = clean_rates
    if body.expense_categories is not None:
        update["expense_categories"] = body.expense_categories
    if body.adjustment_limit_g is not None:
        update["adjustment_limit_g"] = max(float(body.adjustment_limit_g), 0.0)
    await db.settings.update_one({"workspace": workspace}, {"$set": update}, upsert=True)
    return clean(await db.settings.find_one({"workspace": workspace}))


# ===========================================================================
# Bags (material issue / intake)
# ===========================================================================
class BagIn(BaseModel):
    metal: str
    purity: str
    design_name: str
    photos: List[str] = Field(default_factory=list)
    issued_metal_g: float
    issued_stones_count: float = 0
    issued_stones_weight_g: float = 0
    karigar_id: Optional[str] = None
    issue_date: Optional[str] = None
    notes: str = ""
    client_token: Optional[str] = None


class BagEdit(BaseModel):
    design_name: Optional[str] = None
    purity: Optional[str] = None
    photos: Optional[List[str]] = None
    karigar_id: Optional[str] = None
    notes: Optional[str] = None


@api.get("/bags")
async def list_bags(
    workspace: str = Query(REAL),
    metal: str = Query(...),
    purity: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    val_workspace(workspace)
    val_metal(metal)
    q: dict = {"workspace": workspace, "metal": metal}
    if purity:
        q["purity"] = purity
    if status:
        q["status"] = status
    if search:
        q["$or"] = [
            {"bag_no": {"$regex": search, "$options": "i"}},
            {"design_name": {"$regex": search, "$options": "i"}},
        ]
    bags = await db.bags.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    out = []
    for b in bags:
        acc = await compute_bag_accounting(b)
        b["summary"] = {
            "issued_metal_g": acc["issued_metal_g"],
            "outstanding_loss_g": acc["outstanding_loss_g"],
            "metal_loss_g": acc["metal_loss_g"],
        }
        out.append(b)
    return out


@api.get("/bags/purities")
async def bag_purities(workspace: str = Query(REAL), metal: str = Query(...), user: dict = Depends(get_current_user)):
    val_workspace(workspace)
    val_metal(metal)
    vals = await db.bags.distinct("purity", {"workspace": workspace, "metal": metal})
    return sorted([v for v in vals if v])


@api.post("/bags")
async def create_bag(body: BagIn, workspace: str = Query(REAL), user: dict = Depends(get_current_user)):
    val_workspace(workspace)
    val_metal(body.metal)
    if body.issued_metal_g <= 0:
        raise HTTPException(status_code=400, detail="Issued metal must be greater than 0")
    # Idempotent retry: if this client submission already created a bag, return it
    # instead of creating a duplicate (survives an interrupted/re-auth submit).
    if body.client_token:
        existing = await db.bags.find_one({"client_token": body.client_token}, {"_id": 0})
        if existing:
            return existing
    bag_no = await next_bag_no(workspace, body.metal)
    bag_id = new_id()
    bag = {
        "id": bag_id,
        "bag_no": bag_no,
        "workspace": workspace,
        "metal": body.metal,
        "purity": body.purity.strip(),
        "design_name": body.design_name.strip(),
        "photos": body.photos,
        "issued_metal_g": float(body.issued_metal_g),
        "issued_purity": body.purity.strip(),
        "issued_stones_count": float(body.issued_stones_count or 0),
        "issued_stones_weight_g": float(body.issued_stones_weight_g or 0),
        "karigar_id": body.karigar_id,
        "issue_date": body.issue_date or now_iso(),
        "status": "open",
        "notes": body.notes or "",
        "client_token": body.client_token,
        "created_by": user["id"],
        "created_at": now_iso(),
        "history": [history_entry(user, "created", f"Bag {bag_no} opened with {body.issued_metal_g} g")],
    }
    await db.bags.insert_one(dict(bag))

    first_step = await db.steps.find_one({"workspace": workspace, "active": True}, {"_id": 0}, sort=[("order", 1)])
    packet = {
        "id": new_id(),
        "packet_no": f"{bag_no}-P1",
        "workspace": workspace,
        "metal": body.metal,
        "bag_ids": [bag_id],
        "composition": [{"bag_id": bag_id, "metal_g": float(body.issued_metal_g)}],
        "current_step_id": first_step["id"] if first_step else None,
        "metal_weight_g": float(body.issued_metal_g),
        "stone_weight_g": float(body.issued_stones_weight_g or 0),
        "stone_count": float(body.issued_stones_count or 0),
        "pieces": 0,
        "photos": list(body.photos),
        "karigar_id": body.karigar_id,
        "status": "active",
        "parent_ids": [],
        "qc_status": "none",
        "created_by": user["id"],
        "created_at": now_iso(),
        "history": [history_entry(user, "created", "Initial packet from bag issue")],
    }
    await db.packets.insert_one(dict(packet))
    return clean(bag)


@api.get("/bags/{bag_id}")
async def get_bag(bag_id: str, user: dict = Depends(get_current_user)):
    bag = await get_bag_or_404(bag_id)
    acc = await compute_bag_accounting(bag)
    rate = await labour_rate_for(bag["workspace"], bag["metal"])
    costing = await compute_bag_costing(bag, rate)
    packets = await db.packets.find({"composition.bag_id": bag_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    scrap = await db.scrap_returns.find({"bag_id": bag_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    stone_txns = await db.stone_txns.find({"bag_id": bag_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"bag": bag, "accounting": acc, "costing": costing, "packets": packets, "scrap_returns": scrap, "stone_txns": stone_txns}


@api.put("/bags/{bag_id}")
async def edit_bag(bag_id: str, body: BagEdit, user: dict = Depends(get_current_user)):
    bag = await get_bag_or_404(bag_id)
    update = {}
    for field in ("design_name", "purity", "photos", "karigar_id", "notes"):
        val = getattr(body, field)
        if val is not None:
            update[field] = val
    if not update:
        return bag
    await db.bags.update_one(
        {"id": bag_id},
        {"$set": update, "$push": {"history": history_entry(user, "edited", ", ".join(update.keys()))}},
    )
    return clean(await db.bags.find_one({"id": bag_id}))


class ScrapIn(BaseModel):
    scrap_g: float
    note: str = ""


@api.post("/bags/{bag_id}/scrap")
async def add_scrap(bag_id: str, body: ScrapIn, user: dict = Depends(get_current_user)):
    bag = await get_bag_or_404(bag_id)
    if body.scrap_g <= 0:
        raise HTTPException(status_code=400, detail="Scrap must be greater than 0")
    doc = {
        "id": new_id(),
        "workspace": bag["workspace"],
        "metal": bag["metal"],
        "bag_id": bag_id,
        "scrap_g": float(body.scrap_g),
        "note": body.note or "",
        "created_by": user["id"],
        "created_by_name": user["name"],
        "created_at": now_iso(),
    }
    await db.scrap_returns.insert_one(doc)
    await db.bags.update_one({"id": bag_id}, {"$push": {"history": history_entry(user, "scrap", f"{body.scrap_g} g scrap returned")}})
    return clean(doc)


class StoneTxnIn(BaseModel):
    type: str  # add | remove | transfer_out
    count: float = 0
    weight_g: float = 0
    to_bag_id: Optional[str] = None
    note: str = ""


@api.post("/bags/{bag_id}/stones")
async def add_stone_txn(bag_id: str, body: StoneTxnIn, user: dict = Depends(get_current_user)):
    bag = await get_bag_or_404(bag_id)
    if body.type not in ("add", "remove", "transfer_out"):
        raise HTTPException(status_code=400, detail="Invalid stone transaction type")
    doc = {
        "id": new_id(),
        "workspace": bag["workspace"],
        "bag_id": bag_id,
        "type": body.type,
        "count": float(body.count or 0),
        "weight_g": float(body.weight_g or 0),
        "to_bag_id": body.to_bag_id,
        "note": body.note or "",
        "created_by": user["id"],
        "created_by_name": user["name"],
        "created_at": now_iso(),
    }
    await db.stone_txns.insert_one(doc)
    if body.type == "transfer_out" and body.to_bag_id:
        dest = await db.bags.find_one({"id": body.to_bag_id})
        if dest:
            await db.stone_txns.insert_one(
                {
                    "id": new_id(),
                    "workspace": bag["workspace"],
                    "bag_id": body.to_bag_id,
                    "type": "transfer_in",
                    "count": float(body.count or 0),
                    "weight_g": float(body.weight_g or 0),
                    "from_bag_id": bag_id,
                    "note": f"Transfer from {bag['bag_no']}",
                    "created_by": user["id"],
                    "created_by_name": user["name"],
                    "created_at": now_iso(),
                }
            )
    return clean(doc)


# ===========================================================================
# Packets: movements, repack, split, merge, qc, handover
# ===========================================================================
@api.get("/packets")
async def list_packets(
    workspace: str = Query(REAL),
    metal: str = Query(...),
    bag_id: Optional[str] = None,
    status: Optional[str] = "active",
    step_id: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    val_workspace(workspace)
    val_metal(metal)
    q: dict = {"workspace": workspace, "metal": metal}
    if status and status != "all":
        q["status"] = status
    if bag_id:
        q["composition.bag_id"] = bag_id
    if step_id:
        q["current_step_id"] = step_id
    return await db.packets.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.get("/packets/{packet_id}")
async def get_packet(packet_id: str, user: dict = Depends(get_current_user)):
    pkt = await get_packet_or_404(packet_id)
    movements = await db.movements.find({"packet_id": packet_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    handovers = await db.handovers.find({"packet_id": packet_id}, {"_id": 0}).sort("created_at", 1).to_list(200)
    qc = await db.qc_records.find({"packet_id": packet_id}, {"_id": 0}).sort("created_at", 1).to_list(200)
    bag_ids = [c["bag_id"] for c in pkt.get("composition", [])]
    bags = await db.bags.find({"id": {"$in": bag_ids}}, {"_id": 0, "id": 1, "bag_no": 1, "design_name": 1}).to_list(200)
    bag_map = {b["id"]: b for b in bags}
    trace = [
        {
            "bag_id": c["bag_id"],
            "bag_no": bag_map.get(c["bag_id"], {}).get("bag_no"),
            "design_name": bag_map.get(c["bag_id"], {}).get("design_name"),
            "metal_g": c["metal_g"],
        }
        for c in pkt.get("composition", [])
    ]
    return {"packet": pkt, "movements": movements, "handovers": handovers, "qc_records": qc, "traceability": trace}


class MoveIn(BaseModel):
    to_step_id: str
    receipt_weight_g: float  # scale reading when the packet is received at this step
    output_weight_g: float   # weight after the process
    karigar_id: Optional[str] = None
    note: str = ""


def _apply_move_posting(packet_id: str, pkt: dict, mv: dict, user: dict):
    """Build the DB update that posts a movement's output onto the packet."""
    new_comp = scale_composition(pkt["composition"], float(mv["output_weight_g"]))
    return {
        "$set": {
            "current_step_id": mv["to_step_id"],
            "metal_weight_g": float(mv["output_weight_g"]),
            "composition": new_comp,
            "karigar_id": mv.get("karigar_id") or pkt.get("karigar_id"),
            "qc_status": "none",
        },
        "$push": {"history": history_entry(user, "moved", mv.get("_history_detail", "Moved"))},
    }


@api.post("/packets/{packet_id}/move")
async def move_packet(packet_id: str, body: MoveIn, user: dict = Depends(get_current_user)):
    pkt = await get_packet_or_404(packet_id)
    if pkt["status"] != "active":
        raise HTTPException(status_code=400, detail="Only active packets can be moved")
    receipt = float(body.receipt_weight_g)
    output = float(body.output_weight_g)
    if receipt <= 0 or output < 0:
        raise HTTPException(status_code=400, detail="Invalid weights")
    if output > receipt + 1e-9:
        raise HTTPException(status_code=400, detail="Output cannot exceed the received weight")

    previous = float(pkt["metal_weight_g"])
    opening_difference = round(receipt - previous, 4)   # receipt adjustment vs last posted
    process_loss = round(receipt - output, 4)           # loss during the process
    total_change = round(previous - output, 4)          # net reduction of posted stock
    limit = await adjustment_limit_for(pkt["workspace"])
    requires_approval = abs(opening_difference) > 1e-9
    exceeds_limit = abs(opening_difference) > limit + 1e-9
    can_approve = user["role"] in (ROLE_ADMIN, ROLE_MANAGER)

    step = await db.steps.find_one({"id": body.to_step_id}, {"_id": 0})
    step_name = step["name_en"] if step else "step"

    approved = False
    approved_by = approved_by_name = approved_at = None
    status = "posted"
    if requires_approval:
        if can_approve:
            approved = True
            approved_by = user["id"]
            approved_by_name = user["name"]
            approved_at = now_iso()
        else:
            status = "pending_approval"

    mv = {
        "id": new_id(),
        "workspace": pkt["workspace"],
        "metal": pkt["metal"],
        "packet_id": packet_id,
        "from_step_id": pkt.get("current_step_id"),
        "to_step_id": body.to_step_id,
        "previous_weight_g": previous,
        "receipt_weight_g": receipt,
        "output_weight_g": output,
        "opening_difference_g": opening_difference,
        "process_loss_g": process_loss,
        "metal_in_g": receipt,       # kept for backward compatibility
        "metal_out_g": output,
        "loss_g": total_change,      # net posted-stock reduction
        "limit_g": limit,
        "requires_approval": requires_approval,
        "exceeds_limit": exceeds_limit,
        "approved": approved,
        "approved_by": approved_by,
        "approved_by_name": approved_by_name,
        "approved_at": approved_at,
        "status": status,
        "karigar_id": body.karigar_id or pkt.get("karigar_id"),
        "note": body.note or "",
        "created_by": user["id"],
        "created_by_name": user["name"],   # the signed-in operator (not the karigar)
        "created_at": now_iso(),
    }
    await db.movements.insert_one(dict(mv))

    if status == "pending_approval":
        # Do NOT touch posted stock until a manager approves the adjustment.
        return {
            "pending_approval": True,
            "movement_id": mv["id"],
            "opening_difference_g": opening_difference,
            "message": "Weight adjustment recorded — a manager must approve it before stock updates.",
        }

    detail = f"To {step_name}, process loss {process_loss} g"
    if requires_approval:
        detail += f", receipt adj {opening_difference:+} g (approved by {user['name']})"
    mv["_history_detail"] = detail
    await db.packets.update_one({"id": packet_id}, _apply_move_posting(packet_id, pkt, mv, user))
    return clean(await db.packets.find_one({"id": packet_id}))


@api.post("/movements/{movement_id}/approve")
async def approve_movement(movement_id: str, user: dict = Depends(require_roles(ROLE_ADMIN, ROLE_MANAGER))):
    mv = await db.movements.find_one({"id": movement_id, "status": "pending_approval"}, {"_id": 0})
    if not mv:
        raise HTTPException(status_code=404, detail="Pending adjustment not found")
    pkt = await db.packets.find_one({"id": mv["packet_id"]}, {"_id": 0})
    if not pkt or pkt["status"] != "active":
        raise HTTPException(status_code=400, detail="Packet is no longer active")
    await db.movements.update_one(
        {"id": movement_id},
        {"$set": {"status": "posted", "approved": True, "approved_by": user["id"], "approved_by_name": user["name"], "approved_at": now_iso()}},
    )
    mv["_history_detail"] = f"Adjustment {mv['opening_difference_g']:+} g approved by {user['name']}; process loss {mv['process_loss_g']} g"
    await db.packets.update_one({"id": pkt["id"]}, _apply_move_posting(pkt["id"], pkt, mv, user))
    return {"ok": True}


@api.post("/movements/{movement_id}/reject")
async def reject_movement(movement_id: str, user: dict = Depends(require_roles(ROLE_ADMIN, ROLE_MANAGER))):
    res = await db.movements.update_one(
        {"id": movement_id, "status": "pending_approval"},
        {"$set": {"status": "rejected", "approved": False, "approved_by": user["id"], "approved_by_name": user["name"], "approved_at": now_iso()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pending adjustment not found")
    return {"ok": True}


@api.get("/movements/pending")
async def pending_movements(workspace: str = Query(REAL), metal: str = Query(...), user: dict = Depends(get_current_user)):
    val_workspace(workspace)
    val_metal(metal)
    return await db.movements.find({"workspace": workspace, "metal": metal, "status": "pending_approval"}, {"_id": 0}).sort("created_at", -1).to_list(200)


class RepackIn(BaseModel):
    photos: List[str] = Field(default_factory=list)
    stone_weight_g: Optional[float] = None
    stone_count: Optional[float] = None
    pieces: Optional[float] = None
    note: str = ""


@api.post("/packets/{packet_id}/repack")
async def repack_packet(packet_id: str, body: RepackIn, user: dict = Depends(get_current_user)):
    pkt = await get_packet_or_404(packet_id)
    if pkt["status"] != "active":
        raise HTTPException(status_code=400, detail="Only active packets can be repacked")
    update = {}
    if body.photos:
        update["photos"] = (pkt.get("photos") or []) + body.photos
    if body.stone_weight_g is not None:
        update["stone_weight_g"] = float(body.stone_weight_g)
    if body.stone_count is not None:
        update["stone_count"] = float(body.stone_count)
    if body.pieces is not None:
        update["pieces"] = float(body.pieces)
    await db.packets.update_one(
        {"id": packet_id},
        {"$set": update, "$push": {"history": history_entry(user, "repacked", body.note or "Repacked with fresh photo")}},
    )
    return clean(await db.packets.find_one({"id": packet_id}))


class SplitChild(BaseModel):
    metal_g: float
    stone_weight_g: float = 0
    stone_count: float = 0
    pieces: float = 0
    label: str = ""


class SplitIn(BaseModel):
    children: List[SplitChild]
    note: str = ""


@api.post("/packets/{packet_id}/split")
async def split_packet(packet_id: str, body: SplitIn, user: dict = Depends(get_current_user)):
    pkt = await get_packet_or_404(packet_id)
    if pkt["status"] != "active":
        raise HTTPException(status_code=400, detail="Only active packets can be split")
    children = [c for c in body.children if c.metal_g > 0 or c.stone_count > 0 or c.pieces > 0]
    if len(children) < 1:
        raise HTTPException(status_code=400, detail="Enter at least one child packet")

    p_m = float(pkt["metal_weight_g"])
    p_sw = float(pkt.get("stone_weight_g", 0) or 0)
    p_sc = float(pkt.get("stone_count", 0) or 0)
    p_p = float(pkt.get("pieces", 0) or 0)

    s_m = round(sum(c.metal_g for c in children), 4)
    s_sw = round(sum(c.stone_weight_g for c in children), 4)
    s_sc = sum(c.stone_count for c in children)
    s_p = sum(c.pieces for c in children)

    rem_m = round(p_m - s_m, 4)
    rem_sw = round(p_sw - s_sw, 4)
    rem_sc = p_sc - s_sc
    rem_p = p_p - s_p
    if rem_m < -1e-6 or rem_sw < -1e-6 or rem_sc < -1e-6 or rem_p < -1e-6:
        raise HTTPException(status_code=400, detail="Children exceed the packet's metal, stones or pieces")

    def make_child(label, metal_g, stone_w, stone_c, pieces, suffix):
        return {
            "id": new_id(),
            "packet_no": f"{pkt['packet_no']}.{suffix}",
            "workspace": pkt["workspace"],
            "metal": pkt["metal"],
            "bag_ids": list(pkt["bag_ids"]),
            "composition": scale_composition(pkt["composition"], float(metal_g)),
            "current_step_id": pkt.get("current_step_id"),
            "metal_weight_g": round(float(metal_g), 4),
            "stone_weight_g": round(float(stone_w), 4),
            "stone_count": float(stone_c),
            "pieces": float(pieces),
            "photos": [],
            "karigar_id": pkt.get("karigar_id"),
            "status": "active",
            "parent_ids": [packet_id],
            "qc_status": "none",
            "label": label,
            "is_mixed": len(pkt["composition"]) > 1,
            "created_by": user["id"],
            "created_at": now_iso(),
            "history": [history_entry(user, "created", f"Split from {pkt['packet_no']}")],
        }

    created = []
    for i, child in enumerate(children):
        doc = make_child(child.label, child.metal_g, child.stone_weight_g, child.stone_count, child.pieces, chr(97 + i))
        await db.packets.insert_one(dict(doc))
        created.append(clean(doc))

    # Preserve any physical remainder as a live packet — never silent loss.
    remainder = None
    if rem_m > 1e-6 or rem_sw > 1e-6 or rem_sc > 1e-6 or rem_p > 1e-6:
        remainder = make_child("Remainder / बचा", rem_m, rem_sw, rem_sc, rem_p, f"{chr(97 + len(children))}")
        remainder["history"] = [history_entry(user, "created", f"Retained remainder from {pkt['packet_no']}")]
        await db.packets.insert_one(dict(remainder))
        remainder = clean(remainder)

    await db.packets.update_one(
        {"id": packet_id},
        {"$set": {"status": "split"}, "$push": {"history": history_entry(user, "split", f"Into {len(created)} packets" + (" + remainder" if remainder else ""))}},
    )
    return {"parent_id": packet_id, "children": created, "remainder": remainder}


class MergeIn(BaseModel):
    packet_ids: List[str]
    to_step_id: Optional[str] = None
    karigar_id: Optional[str] = None
    note: str = ""


@api.post("/packets/merge")
async def merge_packets(body: MergeIn, workspace: str = Query(REAL), metal: str = Query(...), user: dict = Depends(get_current_user)):
    val_workspace(workspace)
    val_metal(metal)
    if len(body.packet_ids) < 2:
        raise HTTPException(status_code=400, detail="Select at least two packets to merge")
    parents = await db.packets.find({"id": {"$in": body.packet_ids}}, {"_id": 0}).to_list(100)
    if len(parents) != len(body.packet_ids):
        raise HTTPException(status_code=404, detail="Some packets not found")
    for p in parents:
        if p["status"] != "active":
            raise HTTPException(status_code=400, detail=f"Packet {p['packet_no']} is not active")
        if p["metal"] != metal or p["workspace"] != workspace:
            raise HTTPException(status_code=400, detail="All packets must share the same metal and workspace")

    comp_map: dict[str, float] = {}
    metal_total = 0.0
    stone_w = 0.0
    stone_c = 0.0
    pieces_total = 0.0
    bag_ids: set[str] = set()
    for p in parents:
        metal_total += float(p["metal_weight_g"])
        stone_w += float(p.get("stone_weight_g", 0) or 0)
        stone_c += float(p.get("stone_count", 0) or 0)
        pieces_total += float(p.get("pieces", 0) or 0)
        for c in p["composition"]:
            comp_map[c["bag_id"]] = round(comp_map.get(c["bag_id"], 0) + float(c["metal_g"]), 4)
        bag_ids.update(p["bag_ids"])

    composition = [{"bag_id": k, "metal_g": v} for k, v in comp_map.items()]
    is_mixed = len(composition) > 1
    count = await db.packets.count_documents({"workspace": workspace, "metal": metal})
    merged = {
        "id": new_id(),
        "packet_no": f"MIX-{count + 1:04d}" if is_mixed else f"MRG-{count + 1:04d}",
        "workspace": workspace,
        "metal": metal,
        "bag_ids": list(bag_ids),
        "composition": composition,
        "current_step_id": body.to_step_id or parents[0].get("current_step_id"),
        "metal_weight_g": round(metal_total, 4),
        "stone_weight_g": round(stone_w, 4),
        "stone_count": stone_c,
        "pieces": pieces_total,
        "photos": [],
        "karigar_id": body.karigar_id or parents[0].get("karigar_id"),
        "status": "active",
        "parent_ids": body.packet_ids,
        "qc_status": "none",
        "is_mixed": is_mixed,
        "created_by": user["id"],
        "created_at": now_iso(),
        "history": [history_entry(user, "created", f"Merged from {len(parents)} packets")],
    }
    await db.packets.insert_one(dict(merged))
    for pid in body.packet_ids:
        await db.packets.update_one(
            {"id": pid},
            {"$set": {"status": "merged", "merged_into": merged["id"]}, "$push": {"history": history_entry(user, "merged", f"Into {merged['packet_no']}")}},
        )
    return clean(merged)


class HandoverIn(BaseModel):
    to_karigar_id: str
    note: str = ""


@api.post("/packets/{packet_id}/handover")
async def handover_packet(packet_id: str, body: HandoverIn, user: dict = Depends(get_current_user)):
    pkt = await get_packet_or_404(packet_id)
    doc = {
        "id": new_id(),
        "workspace": pkt["workspace"],
        "packet_id": packet_id,
        "from_karigar_id": pkt.get("karigar_id"),
        "to_karigar_id": body.to_karigar_id,
        "note": body.note or "",
        "created_by": user["id"],
        "created_by_name": user["name"],
        "created_at": now_iso(),
    }
    await db.handovers.insert_one(doc)
    await db.packets.update_one(
        {"id": packet_id},
        {"$set": {"karigar_id": body.to_karigar_id}, "$push": {"history": history_entry(user, "handover", "Responsibility handed over")}},
    )
    return clean(doc)


class QCIn(BaseModel):
    result: str  # pass | fail
    rework_step_id: Optional[str] = None
    note: str = ""


@api.post("/packets/{packet_id}/qc")
async def qc_packet(packet_id: str, body: QCIn, user: dict = Depends(get_current_user)):
    pkt = await get_packet_or_404(packet_id)
    if body.result not in ("pass", "fail"):
        raise HTTPException(status_code=400, detail="Result must be pass or fail")
    doc = {
        "id": new_id(),
        "workspace": pkt["workspace"],
        "packet_id": packet_id,
        "result": body.result,
        "rework_step_id": body.rework_step_id,
        "note": body.note or "",
        "created_by": user["id"],
        "created_by_name": user["name"],
        "created_at": now_iso(),
    }
    await db.qc_records.insert_one(doc)
    update: dict = {"qc_status": body.result}
    detail = "Passed QC"
    if body.result == "fail" and body.rework_step_id:
        update["current_step_id"] = body.rework_step_id
        step = await db.steps.find_one({"id": body.rework_step_id}, {"_id": 0})
        detail = f"Failed QC, sent to rework: {step['name_en'] if step else ''}"
    elif body.result == "fail":
        detail = "Failed QC"
    await db.packets.update_one({"id": packet_id}, {"$set": update, "$push": {"history": history_entry(user, "qc", detail)}})
    return clean(doc)


# ===========================================================================
# Recovery (shared metal recovered and allocated by outstanding loss)
# ===========================================================================
@api.get("/recovery/eligible")
async def recovery_eligible(workspace: str = Query(REAL), metal: str = Query(...), purity: Optional[str] = None, user: dict = Depends(get_current_user)):
    val_workspace(workspace)
    val_metal(metal)
    eligible = await eligible_bags_for_recovery(workspace, metal, purity)
    total = round(sum(b["outstanding_loss_g"] for b in eligible), 4)
    return {"eligible": eligible, "total_outstanding_g": total}


class RecoveryIn(BaseModel):
    recovered_g: float
    source: str = ""
    purity: Optional[str] = None
    note: str = ""


@api.post("/recovery")
async def create_recovery(body: RecoveryIn, workspace: str = Query(REAL), metal: str = Query(...), user: dict = Depends(get_current_user)):
    val_workspace(workspace)
    val_metal(metal)
    if body.recovered_g <= 0:
        raise HTTPException(status_code=400, detail="Recovered metal must be greater than 0")
    eligible = await eligible_bags_for_recovery(workspace, metal, body.purity)
    if not eligible:
        raise HTTPException(status_code=400, detail="No bags with outstanding loss to allocate against")
    allocations, leftover = allocate_recovery(float(body.recovered_g), eligible)
    doc = {
        "id": new_id(),
        "workspace": workspace,
        "metal": metal,
        "purity": body.purity,
        "source": body.source or "",
        "recovered_g": float(body.recovered_g),
        "allocations": allocations,
        "unallocated_g": leftover,
        "note": body.note or "",
        "created_by": user["id"],
        "created_by_name": user["name"],
        "created_at": now_iso(),
    }
    await db.recoveries.insert_one(doc)
    return clean(doc)


@api.get("/recovery")
async def list_recovery(workspace: str = Query(REAL), metal: str = Query(...), user: dict = Depends(get_current_user)):
    val_workspace(workspace)
    val_metal(metal)
    return await db.recoveries.find({"workspace": workspace, "metal": metal}, {"_id": 0}).sort("created_at", -1).to_list(300)


# ===========================================================================
# Expenses
# ===========================================================================
class ExpenseIn(BaseModel):
    category: str
    amount: float
    bag_id: Optional[str] = None
    note: str = ""
    date: Optional[str] = None


@api.get("/expenses")
async def list_expenses(workspace: str = Query(REAL), metal: str = Query(...), bag_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    val_workspace(workspace)
    val_metal(metal)
    q: dict = {"workspace": workspace, "metal": metal, "is_deleted": {"$ne": True}}
    if bag_id:
        q["bag_id"] = bag_id
    return await db.expenses.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.post("/expenses")
async def create_expense(body: ExpenseIn, workspace: str = Query(REAL), metal: str = Query(...), user: dict = Depends(get_current_user)):
    val_workspace(workspace)
    val_metal(metal)
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")
    doc = {
        "id": new_id(),
        "workspace": workspace,
        "metal": metal,
        "category": body.category.strip(),
        "amount": float(body.amount),
        "bag_id": body.bag_id,
        "note": body.note or "",
        "date": body.date or now_iso(),
        "is_deleted": False,
        "created_by": user["id"],
        "created_by_name": user["name"],
        "created_at": now_iso(),
    }
    await db.expenses.insert_one(doc)
    return clean(doc)


@api.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, user: dict = Depends(get_current_user)):
    res = await db.expenses.update_one({"id": expense_id}, {"$set": {"is_deleted": True}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    return {"ok": True}


# ===========================================================================
# Karigar payments (salary / per-piece / per-weight)
# ===========================================================================
class PaymentIn(BaseModel):
    karigar_id: str
    period: str = ""
    note: str = ""
    salary_amount: float = 0
    commission_type: Optional[str] = None  # per_stone | per_piece | per_tree
    commission_count: float = 0
    commission_rate: float = 0


COMMISSION_UNITS = {"per_stone": "stone set", "per_piece": "piece buffed", "per_tree": "tree cast"}


@api.get("/payments")
async def list_payments(workspace: str = Query(REAL), metal: str = Query(...), karigar_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    val_workspace(workspace)
    val_metal(metal)
    q: dict = {"workspace": workspace, "metal": metal, "is_deleted": {"$ne": True}}
    if karigar_id:
        q["karigar_id"] = karigar_id
    return await db.payments.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.post("/payments")
async def create_payment(body: PaymentIn, workspace: str = Query(REAL), metal: str = Query(...), user: dict = Depends(get_current_user)):
    val_workspace(workspace)
    val_metal(metal)
    # Verify the karigar belongs to this metal context.
    kar = await db.karigars.find_one({"id": body.karigar_id, "workspace": workspace, "metal": metal})
    if not kar:
        raise HTTPException(status_code=400, detail="Karigar not found in this metal context")

    salary = round(float(body.salary_amount or 0), 2)
    commission_amount = 0.0
    commission_type = None
    if body.commission_type in COMMISSION_UNITS:
        commission_type = body.commission_type
        commission_amount = round(float(body.commission_count or 0) * float(body.commission_rate or 0), 2)
    total = round(salary + commission_amount, 2)
    if total <= 0:
        raise HTTPException(status_code=400, detail="Enter a salary and/or a commission amount")

    doc = {
        "id": new_id(),
        "workspace": workspace,
        "metal": metal,
        "karigar_id": body.karigar_id,
        "salary_amount": salary,
        "commission_type": commission_type,
        "commission_unit": COMMISSION_UNITS.get(commission_type) if commission_type else None,
        "commission_count": float(body.commission_count or 0) if commission_type else 0,
        "commission_rate": float(body.commission_rate or 0) if commission_type else 0,
        "commission_amount": commission_amount,
        "amount": total,
        "mode": "salary_commission",
        "period": body.period or "",
        "note": body.note or "",
        "is_deleted": False,
        "created_by": user["id"],
        "created_by_name": user["name"],
        "created_at": now_iso(),
    }
    await db.payments.insert_one(doc)
    return clean(doc)


@api.delete("/payments/{payment_id}")
async def delete_payment(payment_id: str, user: dict = Depends(get_current_user)):
    res = await db.payments.update_one({"id": payment_id}, {"$set": {"is_deleted": True}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Payment not found")
    return {"ok": True}


# ===========================================================================
# Deliveries (hand finished items to the showroom; closes the bag)
# ===========================================================================
class DeliveryIn(BaseModel):
    packet_ids: List[str] = Field(default_factory=list)
    items_count: int = 0
    gross_weight_g: float = 0  # total finished gross incl. stones
    showroom: str = ""
    note: str = ""
    bag_id: Optional[str] = None  # optional hint, not required


async def refresh_bag_status(bag_id: str, user: dict) -> None:
    """A bag stays open while ANY of its goods are still in production/rework."""
    active = await db.packets.count_documents({"composition.bag_id": bag_id, "status": "active"})
    delivered = await db.packets.count_documents({"composition.bag_id": bag_id, "status": "delivered"})
    new_status = "open" if active > 0 or delivered == 0 else "delivered"
    bag = await db.bags.find_one({"id": bag_id}, {"_id": 0, "status": 1})
    if bag and bag.get("status") != new_status:
        await db.bags.update_one(
            {"id": bag_id},
            {"$set": {"status": new_status}, "$push": {"history": history_entry(user, "status", f"Bag is now {new_status}")}},
        )


@api.get("/deliveries")
async def list_deliveries(workspace: str = Query(REAL), metal: str = Query(...), user: dict = Depends(get_current_user)):
    val_workspace(workspace)
    val_metal(metal)
    return await db.deliveries.find({"workspace": workspace, "metal": metal}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.get("/deliveries/eligible")
async def eligible_packets(workspace: str = Query(REAL), metal: str = Query(...), bag_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    """Only active, QC-passed packets may be dispatched."""
    val_workspace(workspace)
    val_metal(metal)
    q = {"workspace": workspace, "metal": metal, "status": "active", "qc_status": "pass"}
    if bag_id:
        q["composition.bag_id"] = bag_id
    return await db.packets.find(q, {"_id": 0}).sort("created_at", 1).to_list(500)


@api.post("/deliveries")
async def create_delivery(body: DeliveryIn, workspace: str = Query(REAL), metal: str = Query(...), user: dict = Depends(get_current_user)):
    val_workspace(workspace)
    val_metal(metal)
    if not body.packet_ids:
        raise HTTPException(status_code=400, detail="Select at least one packet to dispatch")
    packets = await db.packets.find({"id": {"$in": body.packet_ids}}, {"_id": 0}).to_list(200)
    if len(packets) != len(body.packet_ids):
        raise HTTPException(status_code=404, detail="Some packets not found")
    # Enforce eligibility: only active, QC-passed packets may ship.
    for p in packets:
        if p["status"] != "active":
            raise HTTPException(status_code=400, detail=f"Packet {p['packet_no']} is not active")
        if p.get("qc_status") != "pass":
            raise HTTPException(status_code=400, detail=f"Packet {p['packet_no']} has not passed final QC")

    rate = await labour_rate_for(workspace, metal)
    gross_total = float(body.gross_weight_g or 0)
    items_total = int(body.items_count or 0)

    # Combine the selected packets' composition per source bag.
    bag_metal: dict[str, float] = {}
    for p in packets:
        for c in p.get("composition", []):
            bag_metal[c["bag_id"]] = round(bag_metal.get(c["bag_id"], 0) + float(c["metal_g"]), 4)
    total_metal = sum(bag_metal.values()) or 1.0

    bag_ids = list(bag_metal.keys())
    bags = await db.bags.find({"id": {"$in": bag_ids}}, {"_id": 0, "id": 1, "bag_no": 1, "design_name": 1}).to_list(200)
    bag_map = {b["id"]: b for b in bags}

    # Allocate finished gross, labour and items across the source bags by metal share.
    allocations = []
    assigned_items = 0
    for i, bid in enumerate(bag_ids):
        share = bag_metal[bid] / total_metal
        gross_alloc = round(gross_total * share, 4)
        labour_alloc = round((gross_alloc / 1000.0) * rate, 2)
        if i == len(bag_ids) - 1:
            items_alloc = items_total - assigned_items
        else:
            items_alloc = int(round(items_total * share))
            assigned_items += items_alloc
        allocations.append({
            "bag_id": bid,
            "bag_no": bag_map.get(bid, {}).get("bag_no"),
            "design_name": bag_map.get(bid, {}).get("design_name"),
            "metal_g": bag_metal[bid],
            "gross_weight_g": gross_alloc,
            "labour_amount": labour_alloc,
            "items_count": max(items_alloc, 0),
        })

    doc = {
        "id": new_id(),
        "workspace": workspace,
        "metal": metal,
        "bag_id": bag_ids[0] if len(bag_ids) == 1 else None,
        "bag_no": bag_map.get(bag_ids[0], {}).get("bag_no") if len(bag_ids) == 1 else "Mixed",
        "design_name": bag_map.get(bag_ids[0], {}).get("design_name") if len(bag_ids) == 1 else None,
        "is_mixed": len(bag_ids) > 1,
        "packet_ids": body.packet_ids,
        "items_count": items_total,
        "gross_weight_g": gross_total,
        "labour_rate_per_kg": rate,
        "labour_amount": round(sum(a["labour_amount"] for a in allocations), 2),
        "allocations": allocations,
        "showroom": body.showroom or "",
        "note": body.note or "",
        "created_by": user["id"],
        "created_by_name": user["name"],
        "created_at": now_iso(),
    }
    await db.deliveries.insert_one(dict(doc))

    for pid in body.packet_ids:
        await db.packets.update_one(
            {"id": pid},
            {"$set": {"status": "delivered"}, "$push": {"history": history_entry(user, "delivered", f"Dispatched to {body.showroom or 'showroom'}")}},
        )
    # Only close bags whose goods are fully shipped; others remain open.
    for bid in bag_ids:
        await refresh_bag_status(bid, user)
    return clean(doc)


# ===========================================================================
# Costing summary
# ===========================================================================
@api.get("/costing/summary")
async def costing_summary(workspace: str = Query(REAL), metal: str = Query(...), user: dict = Depends(get_current_user)):
    val_workspace(workspace)
    val_metal(metal)
    rate = await labour_rate_for(workspace, metal)
    bags = await db.bags.find({"workspace": workspace, "metal": metal}, {"_id": 0}).sort("created_at", -1).to_list(500)

    per_bag = []
    per_design: dict[str, dict] = {}
    total_labour = 0.0
    total_expenses = 0.0
    for b in bags:
        c = await compute_bag_costing(b, rate)
        row = {
            "bag_id": b["id"],
            "bag_no": b["bag_no"],
            "design_name": b.get("design_name"),
            "status": b.get("status"),
            **c,
        }
        per_bag.append(row)
        total_labour += c["labour_amount"]
        total_expenses += c["expenses_total"]
        d = b.get("design_name") or "—"
        pd = per_design.setdefault(d, {"design_name": d, "bags": 0, "labour_amount": 0.0, "expenses_total": 0.0, "total_cost": 0.0, "items_delivered": 0})
        pd["bags"] += 1
        pd["labour_amount"] = round(pd["labour_amount"] + c["labour_amount"], 2)
        pd["expenses_total"] = round(pd["expenses_total"] + c["expenses_total"], 2)
        pd["total_cost"] = round(pd["total_cost"] + c["total_cost"], 2)
        pd["items_delivered"] += c["items_delivered"]

    # Factory-level expense totals: ALL non-void expenses counted once, with the
    # unallocated (no-bag) portion shown explicitly. Voided rows are excluded.
    total_expenses_all = 0.0
    unallocated_expenses = 0.0
    async for e in db.expenses.find({"workspace": workspace, "metal": metal, "is_deleted": {"$ne": True}}, {"_id": 0, "amount": 1, "bag_id": 1}):
        amt = float(e.get("amount", 0) or 0)
        total_expenses_all += amt
        if not e.get("bag_id"):
            unallocated_expenses += amt

    # Karigar payroll scoped to this metal (Silver and Gold keep separate workers).
    total_payments = 0.0
    async for p in db.payments.find({"workspace": workspace, "metal": metal, "is_deleted": {"$ne": True}}, {"_id": 0, "amount": 1}):
        total_payments += float(p.get("amount", 0) or 0)

    return {
        "labour_rate_per_kg": rate,
        "per_bag": per_bag,
        "per_design": list(per_design.values()),
        "unallocated_expenses": round(unallocated_expenses, 2),
        "totals": {
            "labour_amount": round(total_labour, 2),
            "expenses_total": round(total_expenses_all, 2),
            "expenses_on_bags": round(total_expenses, 2),
            "unallocated_expenses": round(unallocated_expenses, 2),
            "karigar_payments": round(total_payments, 2),
            "grand_total": round(total_labour + total_expenses_all + total_payments, 2),
        },
    }


# ===========================================================================
# Dashboard
# ===========================================================================
@api.get("/dashboard")
async def dashboard(workspace: str = Query(REAL), metal: str = Query(...), user: dict = Depends(get_current_user)):
    val_workspace(workspace)
    val_metal(metal)
    base = {"workspace": workspace, "metal": metal}
    open_bags = await db.bags.count_documents({**base, "status": "open"})
    delivered_bags = await db.bags.count_documents({**base, "status": "delivered"})

    qc_steps = await db.steps.find({"workspace": workspace, "is_qc": True, "active": True}, {"_id": 0, "id": 1}).to_list(50)
    qc_step_ids = [s["id"] for s in qc_steps]
    in_qc = await db.packets.count_documents({**base, "status": "active", "current_step_id": {"$in": qc_step_ids}}) if qc_step_ids else 0
    rework = await db.packets.count_documents({**base, "status": "active", "qc_status": "fail"})

    today = now_iso()[:10]
    delivered_today = await db.deliveries.count_documents({**base, "created_at": {"$regex": f"^{today}"}})

    recent_moves = await db.movements.find({**base, "status": {"$ne": "rejected"}}, {"_id": 0}).sort("created_at", -1).to_list(8)
    recent_bags = await db.bags.find(base, {"_id": 0}).sort("created_at", -1).to_list(6)
    pending_approvals = await db.movements.count_documents({**base, "status": "pending_approval"})

    eligible = await eligible_bags_for_recovery(workspace, metal)
    recovery_pending_g = round(sum(b["outstanding_loss_g"] for b in eligible), 4)

    return {
        "kpis": {
            "open_bags": open_bags,
            "in_qc": in_qc,
            "rework": rework,
            "delivered_today": delivered_today,
            "delivered_bags": delivered_bags,
            "pending_approvals": pending_approvals,
        },
        "recovery_pending_g": recovery_pending_g,
        "recovery_pending_bags": len(eligible),
        "recent_movements": recent_moves,
        "recent_bags": recent_bags,
    }


# ===========================================================================
# Demo workspace reset
# ===========================================================================
DEMO_COLLECTIONS = [
    "karigars", "bags", "packets", "movements", "handovers", "qc_records",
    "stone_txns", "scrap_returns", "recoveries", "expenses", "payments", "deliveries",
]


@api.post("/demo/reset")
async def reset_demo(user: dict = Depends(require_roles(ROLE_ADMIN, ROLE_MANAGER))):
    # Explicit, narrowly-filtered cleanup of the demo workspace only.
    for coll in DEMO_COLLECTIONS:
        await db[coll].delete_many({"workspace": DEMO})
    await seedmod.seed_steps(db, DEMO)
    await seedmod.seed_settings(db, DEMO)
    await seedmod.seed_demo_data(db)
    return {"ok": True, "message": "Demo workspace reset"}


# ---------------------------------------------------------------------------
# App wiring
# ---------------------------------------------------------------------------
app.include_router(api)
app.include_router(auth.router)
app.include_router(auth.codes_router)
app.include_router(files_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    app.state.index_task = asyncio.create_task(ensure_indexes())
    await auth.seed_admin()
    await seedmod.seed_base(db)
    if await db.bags.count_documents({"workspace": DEMO}) == 0:
        with suppress(Exception):
            await seedmod.seed_demo_data(db)
    with suppress(Exception):
        from storage import init_storage

        init_storage()
        logger.info("Object storage initialized")


@app.on_event("shutdown")
async def on_shutdown():
    task = getattr(app.state, "index_task", None)
    if task:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task

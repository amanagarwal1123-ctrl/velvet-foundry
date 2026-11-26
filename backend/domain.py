"""Business logic: metal/stone accounting, recovery allocation, costing."""
from db import db


async def _packet_attributed(workspace: str, metal: str, bag_id: str) -> float:
    """Metal (g) from this bag still physically present in live/delivered packets."""
    total = 0.0
    cursor = db.packets.find(
        {
            "workspace": workspace,
            "metal": metal,
            "status": {"$in": ["active", "delivered"]},
            "composition.bag_id": bag_id,
        },
        {"_id": 0, "composition": 1},
    )
    async for p in cursor:
        for c in p.get("composition", []):
            if c.get("bag_id") == bag_id:
                total += float(c.get("metal_g", 0) or 0)
    return round(total, 4)


async def _scrap_returned(workspace: str, bag_id: str) -> float:
    total = 0.0
    cursor = db.scrap_returns.find({"workspace": workspace, "bag_id": bag_id}, {"_id": 0, "scrap_g": 1})
    async for s in cursor:
        total += float(s.get("scrap_g", 0) or 0)
    return round(total, 4)


async def _recovered_allocated(workspace: str, bag_id: str) -> float:
    total = 0.0
    cursor = db.recoveries.find({"workspace": workspace, "allocations.bag_id": bag_id}, {"_id": 0, "allocations": 1})
    async for r in cursor:
        for a in r.get("allocations", []):
            if a.get("bag_id") == bag_id:
                total += float(a.get("amount_g", 0) or 0)
    return round(total, 4)


async def _stone_current(workspace: str, bag_id: str) -> dict:
    """Current stones attributed to a bag = issued +/- stone transactions."""
    count = 0.0
    weight = 0.0
    cursor = db.stone_txns.find({"workspace": workspace, "bag_id": bag_id}, {"_id": 0})
    async for t in cursor:
        sign = 1.0 if t.get("type") in ("add",) else -1.0
        if t.get("type") == "transfer_in":
            sign = 1.0
        if t.get("type") in ("remove", "transfer_out"):
            sign = -1.0
        count += sign * float(t.get("count", 0) or 0)
        weight += sign * float(t.get("weight_g", 0) or 0)
    return {"delta_count": count, "delta_weight_g": round(weight, 4)}


async def compute_bag_accounting(bag: dict) -> dict:
    """Full metal + stone accounting for one bag, traceable to the original bag."""
    workspace = bag["workspace"]
    metal = bag["metal"]
    bag_id = bag["id"]

    issued = float(bag.get("issued_metal_g", 0) or 0)
    attributed = await _packet_attributed(workspace, metal, bag_id)
    scrap = await _scrap_returned(workspace, bag_id)
    recovered = await _recovered_allocated(workspace, bag_id)

    loss_gross = round(issued - attributed - scrap, 4)
    outstanding_loss = round(max(loss_gross - recovered, 0.0), 4)

    # Delivered metal for this bag
    delivered = 0.0
    cursor = db.packets.find(
        {"workspace": workspace, "metal": metal, "status": "delivered", "composition.bag_id": bag_id},
        {"_id": 0, "composition": 1},
    )
    async for p in cursor:
        for c in p.get("composition", []):
            if c.get("bag_id") == bag_id:
                delivered += float(c.get("metal_g", 0) or 0)

    stones = await _stone_current(workspace, bag_id)
    issued_stone_count = float(bag.get("issued_stones_count", 0) or 0)
    issued_stone_weight = float(bag.get("issued_stones_weight_g", 0) or 0)

    return {
        "issued_metal_g": round(issued, 4),
        "metal_in_production_g": round(attributed - delivered, 4),
        "delivered_metal_g": round(delivered, 4),
        "scrap_returned_g": round(scrap, 4),
        "metal_loss_g": loss_gross,
        "recovered_allocated_g": round(recovered, 4),
        "outstanding_loss_g": outstanding_loss,
        "issued_stones_count": issued_stone_count,
        "issued_stones_weight_g": issued_stone_weight,
        "current_stones_count": round(issued_stone_count + stones["delta_count"], 4),
        "current_stones_weight_g": round(issued_stone_weight + stones["delta_weight_g"], 4),
    }


async def eligible_bags_for_recovery(workspace: str, metal: str, purity: str | None = None) -> list[dict]:
    """Bags with outstanding (not-yet-recovered) loss, for proportional allocation."""
    query = {"workspace": workspace, "metal": metal}
    if purity:
        query["purity"] = purity
    result = []
    cursor = db.bags.find(query, {"_id": 0})
    async for bag in cursor:
        acc = await compute_bag_accounting(bag)
        if acc["outstanding_loss_g"] > 0:
            result.append(
                {
                    "bag_id": bag["id"],
                    "bag_no": bag.get("bag_no"),
                    "design_name": bag.get("design_name"),
                    "purity": bag.get("purity"),
                    "outstanding_loss_g": acc["outstanding_loss_g"],
                }
            )
    return result


def allocate_recovery(recovered_g: float, eligible: list[dict]) -> tuple[list[dict], float]:
    """Split recovered metal across eligible bags proportional to outstanding loss.

    Each bag is capped at its own outstanding loss; any leftover is returned.
    """
    total_outstanding = sum(b["outstanding_loss_g"] for b in eligible)
    allocations: list[dict] = []
    if total_outstanding <= 0 or recovered_g <= 0:
        return allocations, round(recovered_g, 4)

    remaining = recovered_g
    for b in eligible:
        share = recovered_g * (b["outstanding_loss_g"] / total_outstanding)
        amount = min(share, b["outstanding_loss_g"], remaining)
        amount = round(amount, 4)
        if amount > 0:
            allocations.append(
                {
                    "bag_id": b["bag_id"],
                    "bag_no": b.get("bag_no"),
                    "design_name": b.get("design_name"),
                    "amount_g": amount,
                }
            )
            remaining -= amount
    return allocations, round(max(remaining, 0.0), 4)


async def compute_bag_costing(bag: dict, labour_rate_per_kg: float) -> dict:
    """Costing for a bag using POSTED (historical) delivery values.

    Reads finished gross and labour from each delivery's stored per-bag
    allocation so that later rate changes never rewrite past deliveries.
    """
    workspace = bag["workspace"]
    bag_id = bag["id"]

    gross_finished_g = 0.0
    items = 0
    labour_amount = 0.0
    needs_review = False

    cursor = db.deliveries.find(
        {"workspace": workspace, "$or": [{"bag_id": bag_id}, {"allocations.bag_id": bag_id}]},
        {"_id": 0},
    )
    async for d in cursor:
        allocs = d.get("allocations")
        if allocs:
            for a in allocs:
                if a.get("bag_id") == bag_id:
                    gross_finished_g += float(a.get("gross_weight_g", 0) or 0)
                    items += int(a.get("items_count", 0) or 0)
                    labour_amount += float(a.get("labour_amount", 0) or 0)
        elif d.get("bag_id") == bag_id:
            # Legacy single-bag delivery — use its posted labour amount.
            g = float(d.get("gross_weight_g", 0) or 0)
            gross_finished_g += g
            items += int(d.get("items_count", 0) or 0)
            if d.get("labour_amount") is not None:
                labour_amount += float(d.get("labour_amount", 0) or 0)
            else:
                labour_amount += (g / 1000.0) * float(labour_rate_per_kg or 0)
                needs_review = True

    labour_amount = round(labour_amount, 2)

    expenses_total = 0.0
    cursor = db.expenses.find(
        {"workspace": workspace, "bag_id": bag_id, "is_deleted": {"$ne": True}},
        {"_id": 0, "amount": 1},
    )
    async for e in cursor:
        expenses_total += float(e.get("amount", 0) or 0)

    total_cost = round(labour_amount + expenses_total, 2)
    per_item = round(total_cost / items, 2) if items else 0.0

    return {
        "gross_finished_g": round(gross_finished_g, 4),
        "gross_finished_kg": round(gross_finished_g / 1000.0, 5),
        "labour_rate_per_kg": float(labour_rate_per_kg or 0),
        "labour_amount": labour_amount,
        "expenses_total": round(expenses_total, 2),
        "total_cost": total_cost,
        "items_delivered": items,
        "cost_per_item": per_item,
        "needs_review": needs_review,
    }

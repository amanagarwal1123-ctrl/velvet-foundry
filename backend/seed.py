"""Seed default steps, settings, and demo sample data."""
from db import DEMO, GOLD, REAL, SILVER, new_id, now_iso

DEFAULT_STEPS = [
    {"name_hi": "वैक्स सेटिंग", "name_en": "Wax Setting", "is_qc": False},
    {"name_hi": "ट्री और फ्लास्क", "name_en": "Tree & Flask", "is_qc": False},
    {"name_hi": "कास्टिंग", "name_en": "Casting", "is_qc": False},
    {"name_hi": "कटाई", "name_en": "Cutting", "is_qc": False},
    {"name_hi": "फाइलिंग", "name_en": "Filing", "is_qc": False},
    {"name_hi": "पॉलिश", "name_en": "Polishing", "is_qc": False},
    {"name_hi": "क्वालिटी चेक", "name_en": "Quality Check", "is_qc": True},
]

DEFAULT_EXPENSE_CATEGORIES = [
    {"hi": "वैक्स", "en": "Wax"},
    {"hi": "गैस / ईंधन", "en": "Gas / Fuel"},
    {"hi": "बिजली", "en": "Electricity"},
    {"hi": "केमिकल", "en": "Chemicals"},
    {"hi": "ढुलाई", "en": "Transport"},
    {"hi": "अन्य", "en": "Miscellaneous"},
]

DEFAULT_LABOUR_RATES = {SILVER: 700.0, GOLD: 2500.0}  # ₹ per kg of finished gross


async def seed_steps(db, workspace: str) -> None:
    if await db.steps.count_documents({"workspace": workspace}) > 0:
        return
    for i, s in enumerate(DEFAULT_STEPS):
        await db.steps.insert_one(
            {
                "id": new_id(),
                "workspace": workspace,
                "name_hi": s["name_hi"],
                "name_en": s["name_en"],
                "is_qc": s["is_qc"],
                "order": i,
                "active": True,
                "created_at": now_iso(),
            }
        )


async def seed_settings(db, workspace: str) -> None:
    if await db.settings.find_one({"workspace": workspace}):
        return
    await db.settings.insert_one(
        {
            "id": f"settings:{workspace}",
            "workspace": workspace,
            "labour_rates": dict(DEFAULT_LABOUR_RATES),
            "expense_categories": list(DEFAULT_EXPENSE_CATEGORIES),
            "updated_at": now_iso(),
        }
    )


async def seed_base(db) -> None:
    for ws in (REAL, DEMO):
        await seed_steps(db, ws)
        await seed_settings(db, ws)


async def seed_demo_data(db) -> None:
    """Fresh demo sample so users can explore without touching real data."""
    ws = DEMO
    # Karigars
    karigars = [
        {"id": new_id(), "name": "रमेश / Ramesh", "workspace": ws, "active": True, "created_at": now_iso(), "created_by": None},
        {"id": new_id(), "name": "सुरेश / Suresh", "workspace": ws, "active": True, "created_at": now_iso(), "created_by": None},
        {"id": new_id(), "name": "मोहन / Mohan", "workspace": ws, "active": True, "created_at": now_iso(), "created_by": None},
    ]
    await db.karigars.insert_many([dict(k) for k in karigars])

    steps = await db.steps.find({"workspace": ws, "active": True}, {"_id": 0}).sort("order", 1).to_list(50)
    step0 = steps[0]["id"] if steps else None
    step_cast = steps[2]["id"] if len(steps) > 2 else step0

    # A silver bag with an initial packet, partially moved
    bag_id = new_id()
    pkt_id = new_id()
    await db.bags.insert_one(
        {
            "id": bag_id,
            "bag_no": "S-0001",
            "workspace": ws,
            "metal": SILVER,
            "purity": "92.5",
            "design_name": "झुमका / Jhumka",
            "photos": [],
            "issued_metal_g": 500.0,
            "issued_purity": "92.5",
            "issued_stones_count": 40,
            "issued_stones_weight_g": 12.0,
            "karigar_id": karigars[0]["id"],
            "issue_date": now_iso(),
            "status": "open",
            "notes": "Demo bag",
            "created_by": None,
            "created_at": now_iso(),
            "history": [{"action": "created", "detail": "Demo bag opened", "by_name": "demo", "by_role": "system", "at": now_iso()}],
        }
    )
    await db.packets.insert_one(
        {
            "id": pkt_id,
            "packet_no": "S-0001-P1",
            "workspace": ws,
            "metal": SILVER,
            "bag_ids": [bag_id],
            "composition": [{"bag_id": bag_id, "metal_g": 492.0}],
            "current_step_id": step_cast,
            "metal_weight_g": 492.0,
            "stone_weight_g": 12.0,
            "stone_count": 40,
            "photos": [],
            "karigar_id": karigars[1]["id"],
            "status": "active",
            "parent_ids": [],
            "qc_status": "none",
            "created_by": None,
            "created_at": now_iso(),
            "history": [{"action": "created", "detail": "Initial packet", "by_name": "demo", "by_role": "system", "at": now_iso()}],
        }
    )
    await db.movements.insert_one(
        {
            "id": new_id(),
            "workspace": ws,
            "metal": SILVER,
            "packet_id": pkt_id,
            "from_step_id": step0,
            "to_step_id": step_cast,
            "metal_in_g": 500.0,
            "metal_out_g": 492.0,
            "loss_g": 8.0,
            "karigar_id": karigars[1]["id"],
            "note": "Casting demo",
            "created_by": None,
            "created_by_name": "demo",
            "created_at": now_iso(),
        }
    )

    # A gold bag for metal-context demo
    gbag_id = new_id()
    await db.bags.insert_one(
        {
            "id": gbag_id,
            "bag_no": "G-0001",
            "workspace": ws,
            "metal": GOLD,
            "purity": "22K",
            "design_name": "अंगूठी / Ring",
            "photos": [],
            "issued_metal_g": 80.0,
            "issued_purity": "22K",
            "issued_stones_count": 5,
            "issued_stones_weight_g": 1.5,
            "karigar_id": karigars[2]["id"],
            "issue_date": now_iso(),
            "status": "open",
            "notes": "Demo gold bag",
            "created_by": None,
            "created_at": now_iso(),
            "history": [{"action": "created", "detail": "Demo gold bag", "by_name": "demo", "by_role": "system", "at": now_iso()}],
        }
    )
    await db.packets.insert_one(
        {
            "id": new_id(),
            "packet_no": "G-0001-P1",
            "workspace": ws,
            "metal": GOLD,
            "bag_ids": [gbag_id],
            "composition": [{"bag_id": gbag_id, "metal_g": 80.0}],
            "current_step_id": step0,
            "metal_weight_g": 80.0,
            "stone_weight_g": 1.5,
            "stone_count": 5,
            "photos": [],
            "karigar_id": karigars[2]["id"],
            "status": "active",
            "parent_ids": [],
            "qc_status": "none",
            "created_by": None,
            "created_at": now_iso(),
            "history": [{"action": "created", "detail": "Initial packet", "by_name": "demo", "by_role": "system", "at": now_iso()}],
        }
    )

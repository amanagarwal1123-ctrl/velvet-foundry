# Factory App — Silver & Gold Casting Workshop Manager

> **Build Status — Phase 1 MVP: COMPLETED & TESTED (97% pass, 0 critical bugs).**
> FARM stack (FastAPI + React + MongoDB). Backend verified 100% (auth, OTP codes, movements, split/merge, QC, recovery allocation, payments, delivery, costing). Frontend verified 95% end-to-end. Login: admin@gmail.com / 1803; staff via one-time codes from the supervisor dashboard. Photos use Emergent managed object storage. Phases 2 & 3 (true offline/sync, native installer, reporting, QR labels, backup/restore) remain as planned below.


A record-keeping system for a silver and gold casting factory that follows every bag of wax, metal, and stones from the moment material is issued, through casting, finishing, quality checks and rework, all the way to final delivery at the showroom.
It keeps a complete, photo-guided trail of packet movements, weights, losses, recoveries, and costs — entered by office staff in a simple Hindi/English screen, while karigars are tracked by name without needing to log in.

## Who it's for
- **The owner / admin** — sees and oversees everything across the whole factory.
- **Manager, assistant, accountant** — the only people who log in. They record daily packet movements, weights, repacking, quality results, costs, and deliveries.
- **Karigars (workers)** — tracked as named handlers on every packet for accountability, but they do **not** log in. Their names are managed by the staff who do.

## Core features and experience

**Signing in and handing out access**
- The admin signs in with a fixed email and password.
- Everyone else signs in with a one-time code (OTP) instead of a password.
- A manager's code appears on the admin's dashboard; an assistant's or accountant's code appears on the manager's dashboard. The supervising person reads the code to the staff member so they can sign in.
- Each waiting code is listed with the person's name. Once that person signs in, their code disappears from the list automatically. A manual "clear" button is also available to remove codes at any time.

**Choosing the metal you're working in**
- A clear switch at the top for **Silver** or **Gold**. Switching it filters everything to that metal.
- Within the chosen metal, several purities run side by side at the same time.

**Opening a bag (material issue)**
- Create a bag with one or more large design photographs.
- Record the metal issued (weight and purity) and the stones issued (count and weight).
- Assign the handling karigar and the date.

**Moving packets through production**
- A configurable list of production steps (for example wax setting, tree/flask making, casting, filing, polishing, quality check) comes preloaded and can be edited.
- Move a packet from one step to the next, recording weight in and weight out and the karigar who handled it.
- Running metal balance and the loss at each step are shown automatically.
- Record handovers between karigars so responsibility is always clear.

**Repacking, splitting and merging**
- Repack a packet with a fresh photo whenever its contents change.
- Split one packet into several, merge several into one, and create mixed packets — with the material from each original bag still traceable.

**Quality check and rework**
- Pass or fail a packet at quality check and send failed work back into rework along the right step.

**Metal and stone accounting with full traceability**
- For every bag: metal issued versus returned, reusable scrap/dust, stone changes and transfers, and the actual metal loss — always traceable back to the original bag.

**Loss and recovery**
- Metal recovered from shared processes (for example common casting or polishing dust) is shared back across the eligible bags in proportion to each bag's outstanding, not-yet-recovered loss.

**Costing and worker payment**
- The main labour/manufacturing charge is calculated as rupees per kilogram of finished gross jewellery, stones included.
- Karigar payments support three modes: fixed salary, per piece, and per weight.
- Record other expenses, and see a cost summary per bag, per design, and per item through to showroom delivery.

**Delivery to the showroom**
- Record the final handover of finished items to the selling showroom, closing out the bag.

**History and safety**
- Each record keeps a history of who entered or changed it and when.
- Demo data is kept in a clearly marked demo workspace that can be reset at any time without touching real factory records.

## User flow
1. A staff member asks their supervisor for today's code; the supervisor reads it off their dashboard; the staff member signs in.
2. They pick Silver or Gold.
3. A new bag is opened with design photos and the issued metal and stones.
4. As work happens, packets are moved step by step; weights in and out and the handling karigar are recorded, with balances and losses shown automatically.
5. Packets are repacked, split, merged, quality-checked, and sent for rework as needed — each with photos and weights.
6. When metal is recovered from shared work, it is allocated back across the eligible bags.
7. Labour, worker payments and other expenses are recorded, building up the cost of each bag, design and item.
8. Finished items are delivered to the showroom and the bag is closed, with the full trail available for review.

## UI/UX feel
- Built for staff who may read little: large design photographs lead every screen, with big buttons and short labels.
- Every label appears in both Hindi and English, with a quick language toggle.
- A calm **velvet-blue, silver, and cloud-blue** look, generous spacing, and large touch targets suitable for both desktop and tablet.

## Implementation phases

**Phase 1 — MVP (built now)**
Everything in "Core features and experience" above: OTP-based sign-in with the code dashboard, silver/gold contexts with multiple purities, bag intake with photos, configurable production steps with packet movement and weights, repacking/splitting/merging/mixed packets, quality check and rework, per-bag metal and stone accounting with original-bag traceability, proportional recovery allocation, costing (rupees per kg plus salary/per-piece/per-weight worker payments and expenses), delivery to the showroom, record history, bilingual photo-led interface in the chosen theme, and separate demo and real data. Runs in the browser and can be pinned as a desktop/PWA shortcut; requires an internet connection.

**Phase 2 — Works offline, installs, and reports (later)**
Keep recording when the connection drops, with changes queued and safely synced when back online, plus controls to resolve any clashes between devices. Installs like a desktop program. Richer reporting: profit by design/bag/period, karigar payout statements, wastage and loss analytics, and printable summaries. Editable permissions per role and expanded, exportable history.

**Phase 3 — Hardening and extensions (later)**
Native desktop installer and multi-device sync hardening. Packet QR/barcode labels with label printing and scan-to-find. Showroom/sales-side extensions and delivery tracking. Full data backup, restore, and bulk import/export.

## Assumptions
- **Sign-in** works exactly as described: the admin uses email `admin@gmail.com` with password `1803`; managers, assistants and accountants use one-time codes shown on the supervising person's dashboard (manager codes to the admin, assistant/accountant codes to the manager), with codes listed by name, cleared automatically on sign-in, and a manual clear button. Codes are shared in person via the dashboard — no SMS or email is sent.
- **Roles that log in** are Admin, Manager, Assistant and Accountant. Karigars never log in; they are selectable handler names created and managed by the logged-in staff.
- **Permissions in the MVP** are role-based with sensible defaults (admin sees all; manager runs full operations and hands out codes; assistant and accountant do day-to-day recording). A fine-grained, editable permission screen is a Phase 2 item.
- **Metal contexts** are Silver and Gold, chosen at the top; switching filters all data, and multiple purities operate at once within the selected metal.
- **Units and money:** weights are entered in grams, the main labour rate is rupees per kilogram of finished gross jewellery (stones included), and all money is in Indian Rupees (₹).
- **Recovery** from shared processes is split across eligible bags in proportion to each bag's outstanding (not-yet-recovered) loss.
- **Photos** are uploaded from the user's device and stored using Emergent's managed file storage — no extra account or key is needed from the user.
- **Language:** the interface shows Hindi and English with a toggle; names and free text are stored as typed and are not auto-translated.
- **Starter content:** a common set of casting steps and expense categories is preloaded and can be edited.
- **Offline and desktop (the biggest scope decision):** the MVP is a browser-based web app that can be pinned as a desktop/PWA shortcut but needs an internet connection. True offline operation, background sync with conflict resolution, and a native desktop installer are delivered in Phases 2 and 3 rather than now.
- **Demo data** lives in a clearly marked demo workspace that can be reset without affecting real records.
- **No external services** beyond managed file storage are connected in Phase 1 — no payment gateway, no SMS/email provider, and no outside accounting software.

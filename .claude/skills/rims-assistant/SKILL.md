---
name: rims-assistant
description: Domain knowledge and business rules for the RIMS (Restaurant Inventory Management System) shabu-restaurant project. Use whenever a request involves stock lots, ingredients, storage locations (Freezer/ตู้พักละลาย), FIFO deduction, menu serving capacity, order flow/QR sessions, reorder thresholds, or waste/not-fresh handling. RIMS uses zero AI/LLM calls — everything is SQL/arithmetic. Source of truth is docs/rims_scope_lock_v2.md — this skill is a condensed operational summary of it, not a replacement.
---

# RIMS Domain Knowledge

**Read `docs/rims_scope_lock_v2.md` first for full detail — this is a summary for quick reasoning.**

## Storage model (2 locations — reversed twice, this is current as of 2026-07-15)
- **Freezer** — เนื้อดิบเท่านั้น, หน่วย kg/g
- **ตู้พักละลาย** — พร้อมเสิร์ฟ (เนื้อ+ผัก), หน่วย **จาน (servings)**, แยกนับต่อวัตถุดิบ

**Meat**: Freezer (raw, kg) → UC-N2 (manual, staff only) → ตู้พักละลาย (plates). Conversion kg→plates happens at UC-N2 using standard portion size (e.g. 100g/plate for meat); leftover fractions round down and are lost (not accumulated). `expiry_date` is also recalculated on transfer — remaining shelf life is halved (frozen→thawed degrades faster).

**Vegetables**: never touch Freezer or UC-N2 at all. They're converted kg→plates **immediately at UC-N1 (intake)** using the same round-down rule, and go straight into ตู้พักละลาย as plated stock. `expiry_date` is set once at intake and never recalculated (no freezing ever happened, so no halving).

Do not assume a "ตู้แช่ผัก" (separate raw vegetable storage) exists — that was tried twice (as part of a 3-location model) and reverted both times.

## Lot model
1 lot = 1 receiving round (not 1 per ingredient). Lot header + line items. FIFO is enforced per-ingredient, not per-lot.

## Order flow (single stock-deduction point)
Customer selects → confirms (popup) → grace period (cancelable, `GRACE_PERIOD_SECONDS = 60`) → **System auto-confirms** and deducts stock atomically (`WHERE quantity_remaining >= N`, first-confirm-wins, no staff/waiter ever presses confirm). Menu customization (UC-N9) is cut-only (boolean per ingredient, no quantity adjustment) and is applied to the recipe before deduction.

## Reorder / low-stock alerts (3 separate mechanisms, not combined)
- **UC-N7**: total stock per storage vs Owner-set threshold — compared separately per storage (never summed across kg and plate units)
- **UC-N10**: ตู้พักละลาย low → notifies staff, threshold set by Owner
- **UC-N11**: Freezer meat nearing expiry → notifies staff, 3 days lead time (static, Owner-adjustable)

## Actors (5)
Owner/Admin, พนักงาน (merged Kitchen Staff+Waiter), แคชเชียร์ (QR check-in/out only), Customer (no login), System/Timer. Owner creates staff/cashier accounts directly — no self-registration.

## AI features: none. RIMS uses zero LLM calls anywhere (as of 2026-07-15)
Every feature that was originally planned as "AI" turned out to be either pure arithmetic or a solved problem once the storage model settled, and was replaced with free SQL:
- Ingredient/menu search → plain **autocomplete** (prefix match)
- Waste/not-fresh flagging → `flag_waste_candidates()`, rule-based (near-expiry + no recent movement → templated reason, no confidence score)
- Serving-capacity numbers → plain read from stock, no narrative needed
- Weekly cost/profit → `get_weekly_cost_profit_report()`, SQL aggregation + a `format()` string template
- UC-N3 thaw-prep recommendation → `get_thaw_prep_recommendation()`, pure arithmetic
- UC-N8 procurement recommendation → `get_procurement_recommendation()`, pure arithmetic
- Storage-transfer natural-language parsing → **cut entirely, no replacement** — it solved a problem (moving lots between 3+ storages outside UC-N2) that stopped existing once the model settled on 2 storages with fixed paths (F3d)

Do not propose adding AI/LLM calls back into RIMS itself unless the user explicitly asks — this was a deliberate, repeated decision to keep operating cost at zero.

## Full permission matrix
See `docs/rims_uc_diagram_worksheet.md` §15 for the complete actor × use-case table.

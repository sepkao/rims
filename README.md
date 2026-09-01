# RIMS — Restaurant Inventory Management System

Stock/order management system for a shabu restaurant (QR ordering, FIFO stock deduction, low-stock alerts). Built for a course project, deadline 17 Sep 2026.

**Stack**: Hono (backend) + Supabase/Postgres (database) + React/Vite (2 separate frontend apps, TypeScript). No Docker, no Cloudflare, no AI/LLM calls anywhere — everything is plain SQL/arithmetic.

Read [`docs/rims_scope_lock_v2.md`](docs/rims_scope_lock_v2.md) first if you need business-rule context (storage model, FIFO rules, role permissions, etc.) — it's the source of truth, more detailed than this file.

---

## 0. Before you do anything — prerequisites

- **Node.js v20 or newer** (this project was built on v25). Check with:
  ```bash
  node -v
  ```
- **Git**, obviously — you're reading this from the repo.
- A code editor (VS Code recommended).
- You do **NOT** need to install Postgres, Docker, or Supabase CLI locally. The database is a cloud Supabase project — you only need a connection string (see step 2).

---

## 1. Clone and install

```bash
git clone <repo-url>
cd rims
git checkout mockupDEVKao
```

Each app under `apps/` is a **separate npm project** with its own `package.json` — you must `npm install` inside each one you plan to run, not just at the root.

```
apps/
  api/         Hono backend (Node.js, port 3000)
  customer/    Customer-facing app — QR scan, browse menu, order (Vite, port 5173)
  internal/    Owner/Staff/Cashier dashboards, one codebase, UI changes by role (Vite, port 5174 or whatever Vite picks)
docs/          Scope-lock doc, user stories, flow diagrams, sprint plan, Jira backlog
supabase/
  migrations/0001_init.sql   Full DB schema + all PL/pgSQL functions (reference only — see warning in step 2)
```

```bash
cd apps/api
npm install
cd ../internal
npm install
cd ../customer
npm install
```

---

## 2. Database access — you need a `.env` file (this is the step most people get stuck on)

The backend (`apps/api`) will **not start correctly** without this. `.env` is intentionally **not committed to git** (it's in `.gitignore` — it holds real secrets), so every teammate must create their own copy locally.

### Step 2.1 — get the two secret values from whoever owns the Supabase project

Ask for:
1. **`DATABASE_URL`** — the Supabase "Session pooler" Postgres connection string (looks like `postgresql://postgres.xxxx:PASSWORD@aws-x-xx-xxxx-x.pooler.supabase.com:5432/postgres`). This must come from someone who already has access to the Supabase project dashboard — you cannot generate this yourself.
2. **`SESSION_SECRET`** — ideally reuse the *same* value everyone else uses, so cookies signed by one person's server are still valid when checked by another's. Ask the teammate who set it up to share it (over a private channel, not a group chat/commit).

If for some reason you truly need to generate a brand new `SESSION_SECRET` yourself (e.g. starting totally fresh), run:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
This prints a random 64-character hex string. But prefer reusing the shared one — a mismatched secret just means everyone's login cookies stop working for everyone else.

### Step 2.2 — create the file

Create a new file at exactly this path: **`apps/api/.env`** (note: inside `apps/api`, not the repo root). Put this inside it, filling in the real values:

```
DATABASE_URL=postgresql://postgres.xxxx:yourpassword@aws-x-xx-xxxx-x.pooler.supabase.com:5432/postgres
SESSION_SECRET=the64characterhexstringgoeshere
```

No quotes around the values. No spaces around `=`. Save the file.

### Step 2.3 — verify it works

```bash
cd apps/api
npm run dev
```

You should see `Server is running on http://localhost:3000` in the terminal with **no errors**. Then open a browser (or run `curl http://localhost:3000/health`) — you should get back JSON with a `now` timestamp field, proving the server successfully queried the live database. If you get a connection error, the `DATABASE_URL` is wrong; if the server won't start at all, double check the `.env` file is in `apps/api/` (not the repo root) and has no typos in the variable names.

### ⚠️ Important: local schema file vs. live database can drift

`supabase/migrations/0001_init.sql` is the schema **as originally designed** — it is a reference/history file, **not something that auto-applies**. Editing this file does nothing to the real database by itself. Anyone who changes the live schema (adds a column, a table, a function) has to run that SQL manually in the Supabase dashboard's SQL Editor. This already caused one real bug this project (an `is_active` column existed in the file but not in the live DB, so all logins silently failed) — if something that "should" work according to this file doesn't work live, this drift is the first thing to suspect. Ask the DB owner to confirm the live schema matches before assuming your code is wrong.

---

## 3. Running the apps

**Backend** — needs `.env` from step 2:
```bash
cd apps/api
npm run dev          # http://localhost:3000
```

**Frontend — internal app** (Owner/Staff/Cashier dashboards):
```bash
cd apps/internal
npm run dev          # Vite will print the local URL, usually http://localhost:5173
```

**Frontend — customer app** (QR ordering):
```bash
cd apps/customer
npm run dev
```

Frontend apps don't need their own `.env`. They talk to the backend at `http://localhost:3000` over HTTP — run the backend alongside whichever frontend you're working on if you need real data; otherwise you can build UI against mock/placeholder data with no backend running at all.

---

## 4. Backend — what exists right now, and how to call it

All routes below live in **`apps/api/src/index.ts`**. This is the *entire* backend so far — everything else in the scope doc is not built yet.

| Method | Path | What it does | Auth required |
|---|---|---|---|
| GET | `/health` | DB connectivity check, returns `{ now: ... }` | none |
| POST | `/auth/login` | Body: `{ email, password }`. Sets a signed `session` cookie on success, returns `{ role }` | none |
| POST | `/auth/logout` | Clears the session cookie — works for every role now (was `/owner/logout` and broken for non-owners; fixed) | must be logged in |
| POST | `/owner/users` | Body: `{ name, email, password, role }`. Creates a staff/cashier account | owner only |
| PUT | `/owner/users/:id` | Body: `{ email, password, role }`. Updates an existing account — **no `is_active` toggle or dedicated reset-password route yet**, this one endpoint does full-overwrite edits including password | owner only |
| POST | `/owner/menu-items` | Body: `{ name, price, description }`. Creates a menu item | owner only |
| POST | `/owner/menu-items/:id/ingredients` | Body: `{ ingredient_id, quantity_required_plates, removable }`. Adds one BOM line to a menu item's recipe | owner only |
| GET | `/owner/menu-items` | Lists every menu item joined with its BOM lines (flat rows — one row per ingredient, group by `id` client-side if you want nested) | owner only |
| PUT | `/owner/menu-items/:id` | Body: `{ name, description, price, is_active }`. Edits a menu item (`is_active` is a soft-delete flag — set `false` to hide from customers instead of deleting) | owner only |
| DELETE | `/owner/menu-items/:id` | Deletes a menu item — blocked if any `order_items` reference it; otherwise deletes its BOM rows first, then the item | owner only |
| GET | `/inventory/ingredients` | Lists registered ingredients and their portion presets | owner or staff |
| PUT | `/inventory/ingredients/:id/portion-preset` | Updates an ingredient's kg-per-plate preset | owner only |
| GET | `/inventory/lots` | Lists all stock lots with storage, quantity, expiry and computed status | owner or staff |
| POST | `/inventory/lots` | Receives a multi-line lot atomically; converts vegetable kg to whole Prep plates | owner or staff |
| POST | `/inventory/lots/:id/transfer` | Transfers meat from one Freezer source lot into a traceable Prep sub-lot | staff only |
| POST | `/inventory/ingredients/:id/transfer` | Transfers meat into Prep across fresh source lots in expiry-first order | staff only |

For the implemented Inventory behavior, conversion rules, Prep expiry calculation, filtering, and verification status, see [`docs/inventory_implementation_status.md`](docs/inventory_implementation_status.md).

CORS is enabled (`hono/cors`) for `http://localhost:5173` with `credentials: true` — if your frontend runs on a different port, update the `origin` in `apps/api/src/index.ts` to match, or the browser will block every request with a CORS error.

**Auth model**: this is cookie-session auth, not a token you attach to headers manually. When you `fetch()` from the frontend, you must pass `credentials: 'include'` or the browser will not send/receive the session cookie, and every protected route will 401/403:

```ts
// example: logging in from a frontend page
const res = await fetch('http://localhost:3000/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ email, password }),
})
const data = await res.json()
// data.role is 'owner' | 'staff' | 'cashier' on success, or data.error on failure (401)
```

Every route under `/owner/*` requires the cookie to belong to an active user with `role = 'owner'` — anything else gets `401 Unauthorized` (no/invalid cookie) or `403 Forbidden` (valid cookie, wrong role or account deactivated).

**Still missing or incomplete**: ingredient-threshold settings, automated notifications/waste-review, and some reporting flows are not complete. Stock receive/transfer endpoints now exist; use the Inventory implementation document above as the source of truth for that module. Check [`docs/rims_jira_backlog.csv`](docs/rims_jira_backlog.csv) for the wider planned scope.

---

## 5. Frontend — exact file map (internal app)

Entry chain: **`main.tsx`** → wraps everything in `<AuthProvider>` (from `contexts/AuthContext.tsx`) → renders **`routes.tsx`** (`AppRoutes`) → each `/owner/*` route is wrapped in **`App.tsx`** (renders `<Sidebar />` + the page via `<Outlet />`).

### Auth is real now — read this if you're used to the old mock

**`apps/internal/src/contexts/AuthContext.tsx`** now calls the real backend. `login(role)` and `logout()` both exist on the context: `logout()` calls `POST /auth/logout` with `credentials: 'include'` then clears local state; `login(role)` is called by `login.tsx` after a successful `POST /auth/login` response. There's still one real gap: there's no "who am I" endpoint (`GET /auth/me`), so **refreshing the browser loses the role and sends you back to `/login`** even though the session cookie is still valid server-side — you have to log back in after every full page reload. That's a known limitation, not a bug you introduced.

**`apps/internal/src/pages/login.tsx`** has a working form now (email + password → `fetch POST /auth/login` → `login(data.role)` on success). A `useEffect` watches `role` and redirects: `owner` → `/owner/dashboard`, `staff` → `/staff/orders`, `cashier` → `/cashier/tables`.

Logout is available from **every** role now — the button lives in `Sidebar.tsx` (calls `logout()` from `useAuth()`), not duplicated per-page.

### Route table (from `routes.tsx`)

| Route | Page file | Role required |
|---|---|---|
| `/login` | `pages/login.tsx` | none |
| `/owner/dashboard` | `pages/owner/Dashboard.tsx` | owner |
| `/owner/menu` | `pages/owner/MenuManagement.tsx` | owner |
| `/owner/users` | `pages/owner/UserManagement.tsx` | owner |
| `/owner/settings` | `pages/owner/IngredientSettings.tsx` | owner |
| `/owner/history` | `pages/owner/StockMovementHistory.tsx` | owner |
| `/staff/orders` | `pages/staff/OrdersToServe.tsx` | staff |
| `/staff/available-servings` | `pages/staff/AvailableServings.tsx` | staff |
| `/staff/notifications` | `pages/staff/Notifications.tsx` | staff |
| `/staff/receive-lot` | `pages/staff/ReceiveLot.tsx` | staff |
| `/staff/thaw-prep-recommendation` | `pages/staff/ThawPrepRecommendation.tsx` | staff |
| `/staff/transfer-to-thaw-prep` | `pages/staff/TransferToThawPrep.tsx` | staff |
| `/cashier/tables` | `pages/cashier/TableList.tsx` | cashier |
| `/cashier/checkin` | `pages/cashier/CheckIn.tsx` | cashier |
| `/cashier/checkout` | `pages/cashier/CheckOut.tsx` | cashier |

**Not wired into `routes.tsx` yet** (files exist, but there's no `<Route>` for them):
- `pages/owner/NotFreshInventory.tsx`
- `pages/owner/Notifications.tsx`
- `pages/owner/ProcurementRecommendation.tsx`
- `pages/owner/QrSettings.tsx`
- `pages/owner/SystemLogs.tsx`
- `pages/owner/WasteReview.tsx`

To wire one in, follow the exact pattern already in `routes.tsx`: import the component at the top, add a `<Route path="/owner/..." element={<RequireRole role="owner"><YourPage /></RequireRole>} />` inside the `<Route element={<App/>}>` block, then add a matching entry to the nav array in `sidebar.tsx` if it should be reachable by click (routes and sidebar entries are two separate lists — adding one doesn't add the other).

### Sidebar nav (`components/sidebar.tsx`)

Nav items per role are defined as plain arrays near the top of the file (`ownerNavItems`, `staffNavItems`, `cashierNavItems`) and picked by role via `NavItemsByRole`. If you add a new page and want it in the sidebar, add `{ to: '/your/route', label: 'Label', icon: SomeLucideIcon }` to the matching array — icons come from the `lucide-react` package, already installed.

### Where to write CSS

**`apps/internal/src/index.css`** is the only stylesheet actually imported (see `main.tsx` line 4). It currently has close to nothing. Class names already in the JSX waiting for styles: `.app-layout`, `.app-content`, `.sidebar`, `.sidebar-header`, `.sidebar-title`, `.sidebar-nav`, `.sidebar-bottom`, `.nav-label`, `.active`.

`App.css` exists but is **not imported anywhere** — ignore it, or delete it, don't style it expecting it to show up.

### Page-by-page status (internal app)

Routing, sidebar nav, and logout work for **every** role (owner/staff/cashier). Implementation status varies by module; the Inventory receive, stock, transfer, expired-goods, and portion-preset flows now use real APIs (see the [Inventory implementation status](docs/inventory_implementation_status.md)), while several pages elsewhere are still mock/placeholder:

- `MenuManagement.tsx` — still hardcoded `mockMenuItems` array, doesn't call `GET /owner/menu-items` at all, despite all 5 menu endpoints being done (see §4). This is the highest-value page to wire up next — backend is ready and waiting.
- `UserManagement.tsx` — just a heading and a logout button, doesn't call `POST`/`PUT /owner/users` either, despite those being done and tested since early in the project.
- `Dashboard.tsx` — just `Welcome, {role}!` + a link, no real cards; its backend (weekly report aggregates) doesn't exist yet anyway.
- Staff Inventory pages are functional against the backend. Other staff/cashier flows should be checked individually before treating them as complete.

Don't assume a page's backend is missing just because the page itself is empty — **check §4's endpoint table first**, since several pages (Menu, Users) are blocked on frontend work only, not backend work. Wiring real `fetch()` calls in happens per-page — check the Jira backlog's Sprint column for what's ready, or ask before building a fetch call so you don't build against an endpoint that doesn't exist yet.

### Page-by-page content spec — what each file is actually supposed to show

This is *what to build*, not just "it's empty". Grounded in `docs/rims_user_stories.md` (US-xx) and `docs/rims_scope_lock_v2.md` (UC-Nxx) — read the linked user story for exact acceptance criteria before building the real (non-mock) version.

**`pages/owner/`** (all require `role="owner"`)

| File | What it's for |
|---|---|
| `Dashboard.tsx` | US-13. This-week vs last-week summary cards: revenue, ingredient cost (COGS), waste cost, net profit + % change. All numbers are plain SQL aggregates, never guessed/AI. Also shows a notification badge (count of UC-N7 low-stock alerts + pending waste reviews). View-only — cards don't need to be clickable except the badge, which links to `Notifications.tsx` / `WasteReview.tsx`. |
| `MenuManagement.tsx` | US-10. **Backend is fully ready** (`GET`/`POST`/`PUT`/`DELETE /owner/menu-items`, `POST /owner/menu-items/:id/ingredients` — see §4) — the page itself is still hardcoded mock data, this is pure frontend work now. List all menu items (name + price) from `GET /owner/menu-items`. **Create**: name + price + description, then build the BOM — pick each ingredient + `quantity_required_plates`, and a `removable` true/false toggle per ingredient (this is what lets customers remove that ingredient later, UC-N9). **Edit**: name/description/price freely, plus toggle `is_active` to hide a discontinued item instead of deleting it. **Delete**: the endpoint already blocks it (FK constraint) if the item was ever ordered — surface that error to the Owner, don't let it fail silently. |
| `UserManagement.tsx` | Backend is ready for create/edit (`POST`/`PUT /owner/users`, see §4) — the page itself is still just a heading, doesn't call either endpoint yet. List name/email/role. Create needs name+email+password+role (staff or cashier only — owner accounts are never created through the UI, see §2/F9). Edit covers name/email, role switch, or password reset (all via the same `PUT`, since there's no dedicated reset-password route or `is_active` toggle yet — see the known gap in §4). Delete should be blocked if the account ever did anything in the system — no delete endpoint exists yet, don't build the button until it does. |
| `IngredientSettings.tsx` | US-11. Per-ingredient threshold form, **5 fields for meat**: `reorder_threshold_kg`, `thaw_prep_threshold_plates`, `buffer_percentage`, `supplier_pack_size_kg`, `freezer_expiry_warning_days`. **Vegetables don't have a Freezer**, so don't show `reorder_threshold_kg`/`freezer_expiry_warning_days` for them — only the thaw-prep-cabinet-related fields apply. |
| `WasteReview.tsx` | US-12. Queue of lots the system already flagged (`pending_review`: near-expiry + no movement for 3+ days) with their potential cost shown. Owner clicks **Confirm** → stock is actually deducted and waste cost logged, or **Reject** → lot goes back to normal usable stock, nothing changes. This is a human-in-the-loop approval step, never auto-applied. |
| `NotFreshInventory.tsx` | Read-only list of lots the `mark_not_fresh_lots` scheduled job has already auto-marked expired/not-fresh (past their `expiry_date`). This is the *already-happened* version — different from `WasteReview.tsx`, which is items still awaiting a human decision. |
| `Notifications.tsx` (owner) | Feed of alerts addressed to the Owner: UC-N7 (any ingredient's total stock below its `reorder_threshold`) plus vegetable-specific low-stock alerts (vegetables have no Freezer lot to pull more from, so their low-stock alert goes to Owner instead of staff — see US-08 AC2). |
| `ProcurementRecommendation.tsx` | UC-N8. Shows a concrete next-purchase-cycle number per ingredient, e.g. "แนะนำสั่งเนื้อ 130 กก. เพิ่มจากเดิม 100 กก." — plain arithmetic (`get_procurement_recommendation()`), not AI. If there isn't enough order history yet, show that plainly ("ยังแนะนำไม่ได้ ข้อมูลไม่พอ") rather than guessing a number. Owner still places the actual purchase order outside this system — this page is advisory only, no auto-PO. |
| `QrSettings.tsx` | One setting: `qr_duration_minutes` (seeded default: 120), applies to every table — there's no per-table override. |
| `StockMovementHistory.tsx` | Audit trail read from the `stock_movements` table — every receive/transfer/sale-deduction/return/waste-confirm event, who did it and when. Per a locked scope decision there is deliberately **no separate audit-log table** — this *is* the audit log. |
| `SystemLogs.tsx` | ⚠️ Not clearly specified anywhere in the scope docs beyond "Owner can view system logs" as a permission line — it likely overlaps with `StockMovementHistory.tsx` (same `stock_movements` data) rather than being a separate concept, since the scope doc explicitly says there's no separate audit-log table. Confirm with the team what this page should show before building it, so you don't duplicate `StockMovementHistory.tsx`. |

**`pages/staff/`** (all require `role="staff"`)

| File | What it's for |
|---|---|
| `ReceiveLot.tsx` | US-04 / UC-N1. One form to log an entire incoming delivery at once (meat + vegetables together, not one-by-one). Meat entered in kg goes straight into the Freezer as raw stock, unit unchanged. Vegetables entered in kg are auto-converted to plates (rounded **down**, no leftover fraction carried anywhere) and go straight into the thaw-prep cabinet — they skip the Freezer entirely. |
| `TransferToThawPrep.tsx` | US-05 / UC-N2. **Meat only** (no vegetable option here). Pick a Freezer lot, enter kg pulled out, system auto-converts to plates (rounded down) into the thaw-prep cabinet. The new sub-lot's expiry date is calculated as **half** of the remaining freshness the source lot had. |
| `AvailableServings.tsx` | US-06 / UC-N6. Real-time count of how many plates of each menu item can actually be sold right now, counted **only from the thaw-prep cabinet** (Freezer stock doesn't count, since it's not prepped yet). For a dish needing multiple ingredients, the number shown is the **minimum** across all of them. Should update live via polling, no manual refresh needed. |
| `OrdersToServe.tsx` | Kitchen queue of confirmed orders waiting to be prepared/served. This is also where the "return a plate" actions from US-07 and UC-N12 belong: staff can return a dish to stock (partial quantities allowed, `quantity_returned` increments) any time **before** it's marked served — once `served_at` is set, returns are rejected. Returned stock goes back into the original lot with its `expiry_date` unchanged. |
| `ThawPrepRecommendation.tsx` | UC-N3. "How much should I thaw-prep today" — a daily arithmetic recommendation (`get_thaw_prep_recommendation()`), not AI. Different question from `ProcurementRecommendation.tsx` (that one is weekly/purchasing, this one is daily/prep) — don't conflate the two. |
| `Notifications.tsx` (staff) | Feed of alerts addressed to staff: UC-N10 (thaw-prep cabinet meat below its threshold — there's still Freezer stock to pull more from, unlike the vegetable case) and UC-N11 (Freezer meat within 3 days of expiring; the same lot shouldn't re-alert twice in one day). |

**`pages/cashier/`** (all require `role="cashier"`)

| File | What it's for |
|---|---|
| `TableList.tsx` | US-09. Overview of every table and its current status (open/closed/awaiting cleanup) — the jumping-off point to pick a table for check-in or check-out. |
| `CheckIn.tsx` | US-09. Opens a table for a newly seated customer / issues a fresh QR session, expiring `qr_duration_minutes` (from `QrSettings.tsx`) minutes from now. |
| `CheckOut.tsx` | US-09. Manually closes a table's session when the customer leaves — any still-pending orders on that session get cancelled. (Sessions that simply time out close themselves automatically server-side after expiry + a 60s buffer — this button is only for the "customer leaves early" case.) |

---

## 6. Frontend — customer app (`apps/customer`)

This app has **not been started at all** — it's still the untouched default Vite+React template (`App.tsx` still has the Vite counter demo, `react.svg`/`vite.svg` boilerplate, etc.). There is no routing set up yet, no auth context, nothing project-specific except empty stub files under `src/pages/`:

- `pages/Landing.tsx`
- `pages/Menu.tsx`
- `pages/OrderBuilder.tsx`
- `pages/OrderHistory.tsx`
- `pages/GracePeriodCountdown.tsx`
- `components/QrExpiryBanner.tsx`

If you're picking up this app, you're starting from scratch: you'll need to add a router (see how `apps/internal` does it with `react-router-dom`, already a dependency pattern you can copy), replace the placeholder `App.tsx`, and build each page. No login/session is needed here — this app is for anonymous customers who scan a QR code, not for staff.

### Page-by-page content spec (customer app)

Grounded in `docs/rims_customer_flow.mmd` and `docs/rims_user_stories.md` (US-01/02/03).

| File | What it's for |
|---|---|
| `pages/Landing.tsx` | Entry point right after the QR scan. First checks whether this table's QR/session is still within its time window — if it's already expired, tell the customer to ask a cashier for check-in instead of letting them into the menu. |
| `pages/Menu.tsx` | US-01. Autocomplete search (no need to type an exact full name) with each menu item's ingredients shown inline, not on a separate page. If a dish's stock isn't enough for even one more serving (per UC-N6 "available servings"), it must be rejected right here at selection time — never let a customer pick something and find out it's unavailable later. |
| `pages/OrderBuilder.tsx` | US-02 / US-03 / UC-N9. Pick a quantity, optionally remove ingredients — but **only** ones the Owner flagged `removable` on that menu item (`MenuManagement.tsx` §5 sets this); there's no "reduce quantity of an ingredient" option, removal is all-or-nothing per ingredient. Confirming here opens a second popup confirmation (not a silent submit), which then starts the grace period. |
| `pages/GracePeriodCountdown.tsx` | US-03. 60-second countdown (`GRACE_PERIOD_SECONDS`, same constant used server-side) after the popup confirm, cancelable the whole time. Cancel before it ends → order cancelled, nothing was ever deducted from stock. Let it run out → the order auto-confirms and stock is deducted then (not at the popup-confirm step) — this is also the moment a "someone else just took the last one" rejection can happen; if so, tell the customer plainly that item just sold out and send them back to the menu. |
| `pages/OrderHistory.tsx` | Per-table order list for the current session — shows status of everything ordered so far. Customers can order more rounds any number of times within the same session; this page is where they'd do that (link back to `Menu.tsx`) or call the cashier to close out. |
| `components/QrExpiryBanner.tsx` | Persistent banner meant to render on **every** page (not just one), warning when this table's QR/session is close to or past its expiry time. |

---

## 7. Git workflow

Main work happens on **`mockupDEVKao`**. Don't commit directly to it — branch off into your own branch and open a PR back when ready:

```bash
git checkout mockupDEVKao
git pull
git checkout -b your-name/what-youre-doing
# ... do work, commit ...
git push -u origin your-name/what-youre-doing
```

Then open a PR targeting `mockupDEVKao` (not `main` — `main` only gets updated deliberately from `mockupDEVKao` once things are stable).

**Never commit `apps/api/.env`** — it's gitignored already, but double-check `git status` before pushing if you ever see it listed as a change; that means something is misconfigured and you should stop and ask before pushing.

---

## 8. Current status (as of 23 Aug 2026)

| Part | Status |
|---|---|
| Requirements / scope lock | ✅ Done |
| Database schema + functions | ✅ Done in the reference file (16 tables, FIFO deduction, return, reports, notifications) — confirm with DB owner it's fully applied live, see warning in §2 |
| Frontend scaffolding — internal app | ✅ Routing/sidebar/auth-guard/logout wired for **all 3 roles** (owner, staff, cashier); auth is real (login/logout call the backend). Page *content* is still mostly mock — see §5 |
| Frontend — customer app | ⬜ Not started — default Vite template only |
| Backend API | 🔄 In progress — auth (login/logout) done, full Menu+BOM CRUD done, Staff/cashier account CRUD partially done (missing `is_active` toggle + delete). Stock-lot intake/transfer, ingredient thresholds, table sessions, order flow, notifications, waste review, and reports are all not started — see §4 |
| Frontend ⇄ backend wiring | 🔄 Partial — only login/logout call real endpoints. Menu Management and User Management pages have *ready* backends but still show mock data; everything else is blocked on its backend first |

See [`docs/rims_jira_backlog.csv`](docs/rims_jira_backlog.csv) for the full sprint-by-sprint plan — statuses in that file are now kept in sync with actual code, not just the original plan.

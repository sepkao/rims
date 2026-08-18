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
| POST | `/owner/logout` ⚠️ | Clears the session cookie | owner only (see warning) |
| POST | `/owner/users` | Body: `{ name, email, password, role }`. Creates a staff/cashier account | owner only |
| PUT | `/owner/users/:id` | Body: `{ email, password, role }`. Updates an existing account | owner only |

⚠️ **Known bug**: logout is registered at `/owner/logout`, which means it's caught by the owner-only `/owner/*` middleware below — a staff or cashier account (or anyone whose session already expired) currently **cannot log out**, they'll get `403`/`401` instead. This should eventually move to `/auth/logout` outside the middleware. Don't build a frontend logout button assuming it works for every role until this is fixed.

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

**Nothing else exists yet** — no menu endpoints, no order endpoints, no stock endpoints. Check [`docs/rims_jira_backlog.csv`](docs/rims_jira_backlog.csv) (Sprint column) for what's planned and roughly when.

---

## 5. Frontend — exact file map (internal app)

Entry chain: **`main.tsx`** → wraps everything in `<AuthProvider>` (from `contexts/AuthContext.tsx`) → renders **`routes.tsx`** (`AppRoutes`) → each `/owner/*` route is wrapped in **`App.tsx`** (renders `<Sidebar />` + the page via `<Outlet />`).

### ⚠️ Read this before touching login/auth-related pages

**`apps/internal/src/contexts/AuthContext.tsx`** is currently **fake**. It does not call the backend at all — it just waits 300ms and hardcodes `role = "staff"`. This means right now, no matter what you do, the app always behaves as if a staff user is logged in. Don't be confused if `/owner/*` pages redirect you to `/login` — that's this mock rejecting you because the hardcoded role isn't `"owner"`.

**`apps/internal/src/pages/login.tsx`** is a placeholder — literally just the text "login form goes here but not built". There is no login form yet. Building this page (a real form that POSTs to `/auth/login` with `credentials: 'include'`, then updates `AuthContext` with the real role) is one of the most valuable things to pick up, since almost everything else in the internal app is blocked behind it.

### Route table (from `routes.tsx`)

| Route | Page file | Role required |
|---|---|---|
| `/login` | `pages/login.tsx` | none (placeholder, not built) |
| `/owner/dashboard` | `pages/owner/Dashboard.tsx` | owner |
| `/owner/menu` | `pages/owner/MenuManagement.tsx` | owner |
| `/owner/users` | `pages/owner/UserManagement.tsx` | owner |
| `/owner/settings` | `pages/owner/IngredientSettings.tsx` | owner |
| `/owner/history` | `pages/owner/StockMovementHistory.tsx` | owner |

**Not wired into `routes.tsx` yet** (files exist, but there's no `<Route>` for them — you need to add the route yourself if you build these pages out):
- `pages/owner/NotFreshInventory.tsx`
- `pages/owner/Notifications.tsx`
- `pages/owner/ProcurementRecommendation.tsx`
- `pages/owner/QrSettings.tsx`
- `pages/owner/SystemLogs.tsx`
- `pages/owner/WasteReview.tsx`
- `pages/staff/*` (5 files: `AvailableServings`, `Notifications`, `OrdersToServe`, `ReceiveLot`, `ThawPrepRecommendation`, `TransferToThawPrep`)
- `pages/cashier/*` (3 files: `CheckIn`, `CheckOut`, `TableList`)

To wire one in, follow the exact pattern already in `routes.tsx` for e.g. `/owner/menu`: import the component at the top, add a `<Route path="/staff/..." element={<RequireRole role="staff"><YourPage /></RequireRole>} />` inside the `<Route element={<App/>}>` block.

### Sidebar nav (`components/sidebar.tsx`)

Nav items per role are defined as plain arrays near the top of the file (`ownerNavItems`, `staffNavItems`, `cashierNavItems`) and picked by role via `NavItemsByRole`. If you add a new page and want it in the sidebar, add `{ to: '/your/route', label: 'Label', icon: SomeLucideIcon }` to the matching array — icons come from the `lucide-react` package, already installed.

### Where to write CSS

**`apps/internal/src/index.css`** is the only stylesheet actually imported (see `main.tsx` line 4). It currently has close to nothing. Class names already in the JSX waiting for styles: `.app-layout`, `.app-content`, `.sidebar`, `.sidebar-header`, `.sidebar-title`, `.sidebar-nav`, `.sidebar-bottom`, `.nav-label`, `.active`.

`App.css` exists but is **not imported anywhere** — ignore it, or delete it, don't style it expecting it to show up.

### Page-by-page status (internal app)

Every page under `pages/owner/`, `pages/staff/`, `pages/cashier/` is close to empty right now — most are just a heading or a "Welcome, {role}" message with zero real markup. `Dashboard.tsx` is the most built-out example (still just a paragraph + one link + logout button) — read it as a reference for the `useAuth()` import pattern, not as a finished page. All of them need real JSX (tables, forms, cards) written against **mock/placeholder data** for now, since the matching backend endpoints mostly don't exist yet (see section 4). Wiring real `fetch()` calls in happens once each backend endpoint is ready — check the Jira backlog's Sprint column, or ask before building a real fetch call so you don't build against an endpoint that doesn't exist yet.

### Page-by-page content spec — what each file is actually supposed to show

This is *what to build*, not just "it's empty". Grounded in `docs/rims_user_stories.md` (US-xx) and `docs/rims_scope_lock_v2.md` (UC-Nxx) — read the linked user story for exact acceptance criteria before building the real (non-mock) version.

**`pages/owner/`** (all require `role="owner"`)

| File | What it's for |
|---|---|
| `Dashboard.tsx` | US-13. This-week vs last-week summary cards: revenue, ingredient cost (COGS), waste cost, net profit + % change. All numbers are plain SQL aggregates, never guessed/AI. Also shows a notification badge (count of UC-N7 low-stock alerts + pending waste reviews). View-only — cards don't need to be clickable except the badge, which links to `Notifications.tsx` / `WasteReview.tsx`. |
| `MenuManagement.tsx` | US-10. List all menu items (name + price). **Create**: name + price + description, then build the BOM — pick each ingredient + `quantity_required_plates`, and a `removable` true/false toggle per ingredient (this is what lets customers remove that ingredient later, UC-N9). **Edit**: name/description freely; price change only affects *new* orders, not past ones; BOM rows can be added/removed/qty-changed/removable-toggled. **Delete**: blocked (FK constraint) if the item was ever ordered — show an error, don't silently fail; otherwise delete its BOM rows first, then the item. |
| `UserManagement.tsx` | Already wired to real endpoints (`POST`/`PUT /owner/users`, see §4) — this one's the reference example for what "done" looks like. List name/email/role. Create needs name+email+password+role (staff or cashier only — owner accounts are never created through the UI, see §2/F9). Edit covers name/email, role switch, or password reset. Delete should be blocked if the account ever did anything in the system (received a lot, served an order, etc.) — no delete endpoint exists yet, don't build the button until it does. |
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

## 8. Current status (as of 18 Aug 2026)

| Part | Status |
|---|---|
| Requirements / scope lock | ✅ Done |
| Database schema + functions | ✅ Done in the reference file (16 tables, FIFO deduction, return, reports, notifications) — confirm with DB owner it's fully applied live, see warning in §2 |
| Frontend scaffolding — internal app | 🔄 Partial — routing/sidebar/auth-guard wired for Owner role only; most pages are empty stubs; login form not built; auth is currently mocked/fake |
| Frontend — customer app | ⬜ Not started — default Vite template only |
| Backend API | 🔄 In progress — only `/health`, `/auth/login`, `/owner/logout`, `/owner/users` (POST + PUT) exist so far |
| Frontend ⇄ backend wiring | ⬜ Not started anywhere — no page makes a real `fetch()` call yet |

See [`docs/rims_jira_backlog.csv`](docs/rims_jira_backlog.csv) for the full sprint-by-sprint plan of what's left and roughly when it's scheduled.

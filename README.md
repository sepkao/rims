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

---

## 6. Frontend — customer app (`apps/customer`)

This app has **not been started at all** — it's still the untouched default Vite+React template (`App.tsx` still has the Vite counter demo, `react.svg`/`vite.svg` boilerplate, etc.). There is no routing set up yet, no auth context, nothing project-specific except empty stub files under `src/pages/`:

- `pages/Landing.tsx`
- `pages/Menu.tsx`
- `pages/OrderBuilder.tsx`
- `pages/OrderHistory.tsx`
- `pages/GracePeriodCountdown.tsx`
- `components/QrExpiryBanner.tsx`

If you're picking up this app, you're starting from scratch: you'll need to add a router (see how `apps/internal` does it with `react-router-dom`, already a dependency pattern you can copy), replace the placeholder `App.tsx`, and build each page. No login/session is needed here — this app is for anonymous customers who scan a QR code, not for staff — see `docs/rims_scope_lock_v2.md` for the exact customer flow (grace period, QR expiry, etc.).

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

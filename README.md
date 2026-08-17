# RIMS — Restaurant Inventory Management System

Stock/order management system for a shabu restaurant (QR ordering, FIFO stock deduction, low-stock alerts). Built for a course project, deadline 17 Sep 2026.

**Stack**: Hono (backend) + Supabase/Postgres (database) + React/Vite (2 separate frontend apps). No Docker, no Cloudflare, no AI/LLM calls anywhere — everything is plain SQL/arithmetic.

## Project layout

```
apps/
  api/         Hono backend (Node.js, port 3000)
  customer/    Customer-facing app — QR scan, browse menu, order (port 5173 by default)
  internal/    Internal app — Owner/Staff/Cashier dashboards, shares one codebase, UI changes by role
docs/          Scope-lock doc, user stories, flow diagrams, sprint plan, Jira backlog
supabase/
  migrations/0001_init.sql   Full DB schema + all PL/pgSQL functions
```

Read [`docs/rims_scope_lock_v2.md`](docs/rims_scope_lock_v2.md) first if you need business-rule context (storage model, FIFO rules, role permissions, etc.) — it's the source of truth, more detailed than this file.

## Running each app

Each app is a separate npm project — `cd` into it and run `npm install` once, then:

**Backend (`apps/api`)**
```bash
cd apps/api
npm install
npm run dev          # starts on http://localhost:3000
```
Needs a `.env` file in `apps/api/` (not committed, ask a teammate who has DB access for the values):
```
DATABASE_URL=<Supabase Session pooler connection string>
SESSION_SECRET=<random hex string, used to sign login cookies>
```

**Frontend apps (`apps/customer`, `apps/internal`)**
```bash
cd apps/customer   # or apps/internal
npm install
npm run dev
```
These don't need a `.env` — they just need the backend running (or mock data) to show real content.

## Current status (as of 12 Aug 2026)

| Part | Status |
|---|---|
| Requirements / scope lock | ✅ Done |
| Database schema + functions | ✅ Done (16 tables, FIFO deduction, return, reports, notifications all implemented) |
| Frontend scaffolding | ✅ Done — all page stubs exist (19 pages in `internal`, 6 in `customer`), routing/auth-guard/sidebar wired for Owner |
| Backend API | 🔄 In progress — only `/health`, `/auth/login`, `/auth/logout` + session middleware exist so far |
| Frontend ⇄ backend wiring | ⬜ Not started — every page still shows stub/placeholder content, no real API calls yet |

**Practical implication**: most pages can't show real data yet because the backend endpoints behind them don't exist. See `docs/rims_jira_backlog.csv` for the full sprint-by-sprint plan of what's left.

## What frontend work can happen right now (not blocked on backend)

Two different kinds of work — both are needed, don't assume it's styling-only:

**1. Decorate what already exists (CSS only, no JSX needed)**
The Sidebar + overall app layout already have full JSX structure and className attributes — they just have zero real styling. Write CSS in `apps/internal/src/index.css` (the only stylesheet actually imported — see `main.tsx`; `App.css` exists but isn't imported anywhere, don't bother with it unless you wire it up yourself). Class names waiting for styles: `.app-layout`, `.app-content`, `.sidebar`, `.sidebar-header`, `.sidebar-title`, `.sidebar-nav`, `.sidebar-bottom`, `.nav-label`, `.active`.

**2. Build page structure (JSX first, then CSS)**
Most of the 19 page stubs in `apps/internal/src/pages/` (Dashboard, MenuManagement, UserManagement, etc.) are close to empty — e.g. `Dashboard.tsx` currently has nothing but a welcome message and a logout button, no cards/tables/forms at all. These need real JSX written first (using mock/placeholder data, since there's no backend endpoint to call yet), then styled. Same applies to the 6 page stubs in `apps/customer`.

**Smaller fixes, not styling:**
- `apps/internal/src/components/sidebar.tsx` — bottom "Settings" link isn't role-conditional yet (shows for everyone regardless of role)
- `apps/internal/src/routes.tsx` — only Owner routes are wired up; Staff and Cashier page files exist but aren't connected to the router yet

Anything that needs to *submit* or *fetch* real data (login form, menu CRUD, order flow, etc.) should wait until the matching backend endpoint exists — check `docs/rims_jira_backlog.csv` (Sprint column) for what's done vs pending. Build the JSX/CSS against mock data in the meantime; wiring to the real API happens later (Sprint 11 in the backlog).

## Git workflow

Main work happens on `mockupDEVKao`. If you're joining to work on frontend, branch off from `mockupDEVKao` into your own branch and open a PR back when ready, rather than committing directly — avoids stepping on backend work landing in parallel.

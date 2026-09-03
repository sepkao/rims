# RIMS Cashier System — Current Implementation

This document describes the Cashier module as it is implemented. Product requirements remain in `rims_scope_lock_v2.md` and `rims_user_stories.md`; this file does not override them.

## Required deployment setup

1. From `apps/api`, run `npm run cashier:p0`. It detects whether the core schema is absent, then applies `0001_init.sql` when needed, `0002_cashier_hardening.sql`, `0003_cashier_expiry_schedule.sql`, `0005_cashier_stock_deduction_signature.sql`, and `0006_fifo_expiry_guard.sql`. Run `npm run cashier:p0:check` for a read-only readiness check.
2. Set `VITE_CUSTOMER_APP_URL` for the internal app. Copy `apps/internal/.env.example`; in production this must be the public HTTPS URL of the customer app, not `localhost`.
3. Set `VITE_PROMPTPAY_ID` in the internal app environment before release. Do not commit the real recipient number.
4. Migration `0003_cashier_expiry_schedule.sql` enables pg_cron and schedules table-session expiry and order confirmation every minute. Migration `0006_fifo_expiry_guard.sql` prevents expired Prep lots from being deducted and schedules freshness-flag reconciliation. The Node worker is a development fallback only and is disabled when `NODE_ENV=production`.

For phone testing on the same LAN, both `VITE_CUSTOMER_APP_URL` and `VITE_API_URL` must use the development PC's LAN IP, and the Vite/API servers must be reachable from that device. `localhost` on a phone points to the phone itself.

## Implemented flow

### Access control

- Internal authentication uses signed session cookies.
- Cashier routes require `role = cashier` and an active user account.

### Table list

- Lists all tables, active session, guest count, remaining time, pending and confirmed order counts.
- Polls every 10 seconds and offers manual refresh.
- Shows `empty`, `occupied`, `near_expiry`, `expired`, and `pending_cleanup` states.
- A Cashier can open a current QR, check out an occupied table, or mark a cleaned table as available.

### Check-in and QR

- Check-in validates non-negative whole-number headcounts and requires at least one guest.
- The server locks the table row, requires it to be `empty`, and creates an active session atomically. The database also enforces one active session per table.
- Buffet prices and QR duration are copied into the session at check-in.
- QR tokens are cryptographically random. Regenerating one invalidates the previous token.
- Cashier can view, download, and print the QR. The QR contains the configured customer-app URL and session token.

### Checkout and payment recording

- Checkout locks an active session, records payment, cancels only pending orders, closes the session, and changes the table to `pending_cleanup` in one transaction.
- Cash payment requires tendered amount and stores calculated change.
- PromptPay and card are manually verified methods: Cashier must enter a reference after verification. No bank or EDC gateway is connected.
- Each checkout creates a `cashier_payments` record and a receipt number such as `RIMS-00000001`.
- The receipt is printable through the browser. It is not sent to a thermal printer and no PDF file is generated.

### Notifications

- Customer Call Staff events and 30-minute, 5-minute, and expiry notices appear in the Cashier notification panel.
- The panel polls every 3 seconds. Read state is retained in `cashier_notifications`.

## Explicit limits

- PromptPay QR generation does not prove that money arrived. Cashier must verify payment manually.
- Card completion is also manual; the system stores the EDC reference only.
- No thermal-printer protocol, bank API, payment gateway, shift/drawer management, or PDF export exists.
- Customer pages still have separate integration work. In particular, all customer requests must consistently use the QR token; do not treat the legacy mock `table_session_id=1` fallback as production behavior.

## Verification

- API build and payment-validation tests: `apps/api` TypeScript build plus `node --test dist/cashier-payment.test.js`.
- Internal and customer TypeScript checks should pass before release.
- With the API running, `npm run cashier:p0:smoke --workspace api` creates isolated temporary cashier/table/session/order records, verifies the QR ordering flow over HTTP, then removes those records.
- Manual UAT: Cashier login → open empty table → scan printed QR from another device → place pending order → checkout with each payment method → confirm pending order cancellation and `pending_cleanup` → mark table clean → check in again.

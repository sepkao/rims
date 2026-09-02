# RIMS Cashier System — Current Implementation

This document describes the Cashier module as it is implemented. Product requirements remain in `rims_scope_lock_v2.md` and `rims_user_stories.md`; this file does not override them.

## Required deployment setup

1. Apply `supabase/migrations/0001_init.sql` and then `supabase/migrations/0002_cashier_hardening.sql`.
2. Set `VITE_CUSTOMER_APP_URL` for the internal app. Copy `apps/internal/.env.example`; in production this must be the public HTTPS URL of the customer app, not `localhost`.
3. Configure the PromptPay recipient number in `CheckOut.tsx` before release. The current number is a development placeholder.
4. Run the table-expiry schedule in production. The database function is `expire_table_sessions()`; pg_cron is the preferred production scheduler. The Node worker only provides development fallback behavior.

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
- Manual UAT: Cashier login → open empty table → scan printed QR from another device → place pending order → checkout with each payment method → confirm pending order cancellation and `pending_cleanup` → mark table clean → check in again.

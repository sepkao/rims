-- Cashier P0 production scheduler. Apply after 0002_cashier_hardening.sql.
-- pg_cron uses standard cron granularity, so production expiry is reconciled
-- once per minute. API reads still reject an expired QR immediately by time.

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
    'rims-expire-table-sessions',
    '* * * * *',
    'SELECT public.expire_table_sessions();'
);

-- Confirm every order whose 60-second grace period has elapsed. The function
-- locks and rechecks each order, so overlapping app/cron runs are safe.
SELECT cron.schedule(
    'rims-auto-confirm-orders',
    '* * * * *',
    'SELECT public.auto_confirm_order(id) FROM public.orders WHERE status = ''pending'' AND confirm_at <= now();'
);

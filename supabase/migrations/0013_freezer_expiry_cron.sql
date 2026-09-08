-- Schedule UC-N11 (Freezer near-expiry warning) the same way 0006_fifo_expiry_guard.sql
-- schedules mark_not_fresh_lots(): only if pg_cron is actually installed (production),
-- so this migration is a safe no-op on a local dev database without the extension.
--
-- check_freezer_expiry_warnings() (defined in 0001_init.sql) was previously never
-- scheduled or called anywhere — it existed in the DB but never ran. See
-- rims_checklist_audit_2026-09.md item 6.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.schedule(
            'rims-check-freezer-expiry-warnings',
            '* * * * *',
            'SELECT public.check_freezer_expiry_warnings();'
        );
    END IF;
END;
$$;

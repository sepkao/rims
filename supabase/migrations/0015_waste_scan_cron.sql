-- [SYS06] Last of the 5 jobs listed in 0001_init.sql's scheduling note
-- (mark_not_fresh_lots, expire_table_sessions, check_freezer_expiry_warnings,
-- flag_waste_candidates, auto_confirm_order — see that comment for the full list).
-- flag_waste_candidates() (rule-based, free SQL — no AI/LLM cost concern, see round 10
-- in rims_scope_lock_v2.md) was previously manual-only via POST /owner/waste-records/scan.
-- Same pattern as 0006/0013: only schedules if pg_cron is actually installed, so this is
-- a safe no-op on a local dev database without the extension.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.schedule(
            'rims-flag-waste-candidates',
            '* * * * *',
            'SELECT public.flag_waste_candidates();'
        );
    END IF;
END;
$$;

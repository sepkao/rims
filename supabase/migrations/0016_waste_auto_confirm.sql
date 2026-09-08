-- Per user decision 2026-09-08: a waste_records row that's been sitting in
-- 'pending_review' (flagged 2 days before expiry by flag_waste_candidates(), see
-- 0001_init.sql) with nobody clicking Confirm/Reject would otherwise sit there forever
-- — the underlying stock_lot still passes its real expiry_date, gets marked
-- is_not_fresh by mark_not_fresh_lots(), but quantity_remaining and the official
-- waste_cost accounting never update. This auto-confirms it once the lot's actual
-- expiry_date arrives, mirroring exactly what PUT /owner/waste-records/:id does for a
-- manual "confirmed" (see apps/api/src/index.ts) — same UPDATE stock_lots, same
-- stock_movements 'adjustment' row — just with reviewed_by = NULL (system), same
-- convention as stock_movements.actor_id NULL elsewhere in this schema.
CREATE OR REPLACE FUNCTION auto_confirm_waste_candidates() RETURNS void AS $$
DECLARE
    v_record RECORD;
BEGIN
    FOR v_record IN
        SELECT wr.id, wr.stock_lot_id, wr.quantity
        FROM waste_records wr
        JOIN stock_lots sl ON sl.id = wr.stock_lot_id
        WHERE wr.status = 'pending_review'
          AND sl.expiry_date <= now()
    LOOP
        UPDATE waste_records
        SET status = 'confirmed',
            reviewed_by = NULL,
            ai_reason = COALESCE(ai_reason, '') || ' — หมดอายุแล้วโดยไม่มีการตรวจจาก Owner ระบบยืนยันเป็นของเสียอัตโนมัติ'
        WHERE id = v_record.id;

        UPDATE stock_lots SET quantity_remaining = 0 WHERE id = v_record.stock_lot_id;

        INSERT INTO stock_movements (stock_lot_id, movement_type, quantity, actor_id)
        VALUES (v_record.stock_lot_id, 'adjustment', -v_record.quantity, NULL);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.schedule(
            'rims-auto-confirm-waste-candidates',
            '* * * * *',
            'SELECT public.auto_confirm_waste_candidates();'
        );
    END IF;
END;
$$;

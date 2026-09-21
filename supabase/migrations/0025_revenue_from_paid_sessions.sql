-- Recognise revenue at payment, not at check-in.
--
-- The report previously summed headcount x snapshotted price for every
-- table_session that started in the window, whether or not anyone ever paid:
-- a walkout, or a session auto-closed by expire_table_sessions() without a
-- checkout, still landed in revenue and profit. cashier_payments.subtotal is
-- computed server-side from the same session prices at checkout, so joining
-- it both restricts the report to sessions that were actually paid and states
-- the amount actually billed. table_session_id is UNIQUE there, so the join
-- cannot duplicate a session.

CREATE OR REPLACE FUNCTION get_weekly_cost_profit_report(p_week_start DATE DEFAULT date_trunc('week', now())::date)
RETURNS TABLE (
    week_start DATE,
    revenue DECIMAL,
    cogs DECIMAL,
    waste_cost DECIMAL,
    profit DECIMAL,
    profit_margin_pct DECIMAL,
    narrative TEXT
) AS $$
DECLARE
    v_revenue DECIMAL;
    v_cogs DECIMAL;
    v_waste DECIMAL;
    v_profit DECIMAL;
    v_prev_profit DECIMAL;
    v_trend DECIMAL;
BEGIN
    SELECT COALESCE(SUM(cp.subtotal), 0) INTO v_revenue
    FROM table_sessions ts
    JOIN cashier_payments cp ON cp.table_session_id = ts.id
    WHERE ts.started_at >= p_week_start AND ts.started_at < p_week_start + INTERVAL '7 days';

    SELECT COALESCE(SUM(-sm.quantity * sl.unit_cost), 0) INTO v_cogs
    FROM stock_movements sm
    JOIN stock_lots sl ON sl.id = sm.stock_lot_id
    WHERE sm.movement_type = 'deduction'
      AND sm.created_at >= p_week_start AND sm.created_at < p_week_start + INTERVAL '7 days';

    SELECT COALESCE(SUM(wr.waste_cost), 0) INTO v_waste
    FROM waste_records wr
    WHERE wr.status = 'confirmed'
      AND wr.created_at >= p_week_start AND wr.created_at < p_week_start + INTERVAL '7 days';

    v_profit := v_revenue - v_cogs - v_waste;

    SELECT (prev.revenue - prev.cogs - prev.waste) INTO v_prev_profit
    FROM (
        SELECT
          (SELECT COALESCE(SUM(cp2.subtotal), 0)
             FROM table_sessions ts2
             JOIN cashier_payments cp2 ON cp2.table_session_id = ts2.id
             WHERE ts2.started_at >= p_week_start - INTERVAL '7 days' AND ts2.started_at < p_week_start) AS revenue,
          (SELECT COALESCE(SUM(-sm2.quantity * sl2.unit_cost), 0) FROM stock_movements sm2
             JOIN stock_lots sl2 ON sl2.id = sm2.stock_lot_id
             WHERE sm2.movement_type = 'deduction' AND sm2.created_at >= p_week_start - INTERVAL '7 days' AND sm2.created_at < p_week_start) AS cogs,
          (SELECT COALESCE(SUM(wr2.waste_cost), 0) FROM waste_records wr2
             WHERE wr2.status = 'confirmed' AND wr2.created_at >= p_week_start - INTERVAL '7 days' AND wr2.created_at < p_week_start) AS waste
    ) prev;

    v_trend := CASE WHEN v_prev_profit IS NOT NULL AND v_prev_profit != 0
                    THEN ROUND(((v_profit - v_prev_profit) / ABS(v_prev_profit) * 100)::numeric, 1)
                    ELSE NULL END;

    RETURN QUERY SELECT
        p_week_start,
        v_revenue, v_cogs, v_waste, v_profit,
        CASE WHEN v_revenue > 0 THEN ROUND((v_profit / v_revenue * 100)::numeric, 1) ELSE 0 END,
        format('สัปดาห์นี้กำไร %s บาท (รายได้ %s − ต้นทุนวัตถุดิบ %s − ของเสีย %s บาท)%s',
               v_profit, v_revenue, v_cogs, v_waste,
               CASE WHEN v_trend IS NOT NULL THEN format(', เปลี่ยนจากสัปดาห์ก่อน %s%%', v_trend) ELSE '' END);
END;
$$ LANGUAGE plpgsql;

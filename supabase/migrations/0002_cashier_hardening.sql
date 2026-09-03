-- Cashier production hardening. Apply after 0001_init.sql.
-- The product is buffet-only: no service charge or VAT is added here.

CREATE TABLE IF NOT EXISTS cashier_notifications (
    id               BIGSERIAL PRIMARY KEY,
    table_session_id BIGINT REFERENCES table_sessions(id) ON DELETE CASCADE,
    table_number     TEXT NOT NULL,
    message          TEXT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_read          BOOLEAN NOT NULL DEFAULT false
);

-- Older development databases may already have this table with nullable
-- columns and no session foreign key. Harden that shape before enforcing the
-- production contract; invalid legacy rows intentionally stop the migration
-- for manual repair. The migration remains safe to run more than once.
ALTER TABLE cashier_notifications
    ALTER COLUMN table_number SET NOT NULL,
    ALTER COLUMN message SET NOT NULL,
    ALTER COLUMN created_at SET DEFAULT now(),
    ALTER COLUMN created_at SET NOT NULL,
    ALTER COLUMN is_read SET DEFAULT false,
    ALTER COLUMN is_read SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'cashier_notifications_table_session_id_fkey'
          AND conrelid = 'cashier_notifications'::regclass
    ) THEN
        ALTER TABLE cashier_notifications
            ADD CONSTRAINT cashier_notifications_table_session_id_fkey
            FOREIGN KEY (table_session_id) REFERENCES table_sessions(id) ON DELETE CASCADE;
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_cashier_notifications_unread
    ON cashier_notifications (created_at DESC) WHERE is_read = false;

CREATE TABLE IF NOT EXISTS cashier_payments (
    id                BIGSERIAL PRIMARY KEY,
    receipt_number    TEXT UNIQUE,
    table_session_id  BIGINT NOT NULL UNIQUE REFERENCES table_sessions(id),
    cashier_id        BIGINT NOT NULL REFERENCES users(id),
    payment_method    TEXT NOT NULL CHECK (payment_method IN ('cash', 'promptpay', 'card')),
    subtotal          DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0),
    cash_received     DECIMAL(10,2) CHECK (cash_received IS NULL OR cash_received >= 0),
    change_amount     DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (change_amount >= 0),
    payment_reference TEXT,
    payment_status    TEXT NOT NULL DEFAULT 'manually_confirmed'
                      CHECK (payment_status IN ('manually_confirmed', 'gateway_confirmed')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (
      (payment_method = 'cash' AND cash_received IS NOT NULL AND cash_received >= subtotal)
      OR (payment_method IN ('promptpay', 'card') AND payment_reference IS NOT NULL)
    )
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'table_sessions_valid_duration'
          AND conrelid = 'table_sessions'::regclass
    ) THEN
        ALTER TABLE table_sessions
            ADD CONSTRAINT table_sessions_valid_duration CHECK (expires_at > started_at);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'table_sessions_has_guest'
          AND conrelid = 'table_sessions'::regclass
    ) THEN
        ALTER TABLE table_sessions
            ADD CONSTRAINT table_sessions_has_guest CHECK (
                adult_count + child_count + senior_count + disabled_count > 0
            );
    END IF;
END;
$$;

-- Keep confirmation atomic. A nested PL/pgSQL exception block is a
-- subtransaction: failed FIFO deductions roll back before cancellation is saved.
CREATE OR REPLACE FUNCTION auto_confirm_order(p_order_id BIGINT) RETURNS BOOLEAN AS $$
DECLARE
    v_item RECORD;
    v_ok BOOLEAN;
BEGIN
    PERFORM 1
    FROM orders
    WHERE id = p_order_id
      AND status = 'pending'
      AND confirm_at <= now()
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    BEGIN
        FOR v_item IN
            SELECT oi.id AS order_item_id,
                   mii.ingredient_id,
                   mii.quantity_required_plates * oi.quantity AS plates_needed
            FROM order_items oi
            JOIN menu_item_ingredients mii ON mii.menu_item_id = oi.menu_item_id
            WHERE oi.order_id = p_order_id
              AND mii.ingredient_id NOT IN (
                  SELECT oic.ingredient_id
                  FROM order_item_customizations oic
                  WHERE oic.order_item_id = oi.id
              )
        LOOP
            v_ok := deduct_stock_fifo(
                v_item.ingredient_id,
                v_item.plates_needed,
                p_order_id,
                v_item.order_item_id
            );
            IF NOT v_ok THEN
                RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INSUFFICIENT_STOCK';
            END IF;
        END LOOP;

        UPDATE orders
        SET status = 'confirmed', confirmed_at = now()
        WHERE id = p_order_id;
        RETURN TRUE;
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        UPDATE orders
        SET status = 'cancelled', cancelled_at = now()
        WHERE id = p_order_id AND status = 'pending';
        RETURN FALSE;
    END;
END;
$$ LANGUAGE plpgsql;

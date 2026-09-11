-- New cashier payments accept only cash or PromptPay.
-- NOT VALID preserves any historical card rows while still enforcing the rule
-- for every new or updated payment.
ALTER TABLE cashier_payments
    DROP CONSTRAINT IF EXISTS cashier_payments_payment_method_check;

ALTER TABLE cashier_payments
    ADD CONSTRAINT cashier_payments_payment_method_check
    CHECK (payment_method IN ('cash', 'promptpay')) NOT VALID;

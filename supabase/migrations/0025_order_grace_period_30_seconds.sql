-- Orders can be cancelled for 30 seconds after submission. The API owns each
-- order's exact confirm_at deadline; this sweep catches orders whose customer
-- page is no longer open to finalize them at the deadline.
SELECT cron.schedule(
    'rims-auto-confirm-orders',
    '30 seconds',
    'SELECT public.auto_confirm_order(id) FROM public.orders WHERE status = ''pending'' AND confirm_at <= now();'
);

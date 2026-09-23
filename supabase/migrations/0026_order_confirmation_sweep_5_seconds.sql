-- Once an order's 30-second customer cancellation window ends, make it reach
-- the serving queue promptly even if the customer closed the countdown page.
SELECT cron.schedule(
    'rims-auto-confirm-orders',
    '5 seconds',
    'SELECT public.auto_confirm_order(id) FROM public.orders WHERE status = ''pending'' AND confirm_at <= now();'
);

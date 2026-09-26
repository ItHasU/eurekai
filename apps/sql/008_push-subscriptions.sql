-- Web push subscriptions : one row per browser that accepted the notifications (see
-- dagda/server/push). The endpoint is the URL of the browser's push service, unique to the
-- subscription, the keys are used to encrypt the messages sent to it.
CREATE TABLE IF NOT EXISTS public."pushSubscriptions" (
    endpoint text PRIMARY KEY,
    p256dh text NOT NULL,
    auth text NOT NULL
);

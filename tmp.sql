CREATE TABLE IF NOT EXISTS public.users
(
    "id" serial,
    "uid" text NOT NULL,
    "displayName" text NOT NULL,
    "enabled" boolean NOT NULL DEFAULT false,
    CONSTRAINT users_uid_unique UNIQUE (uid)
);
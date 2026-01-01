ALTER TABLE IF EXISTS public.pictures
    ADD COLUMN type integer NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS public.attachments
    ADD COLUMN type integer NOT NULL DEFAULT 0;
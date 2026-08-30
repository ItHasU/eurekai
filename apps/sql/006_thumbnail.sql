-- Lazily-generated, base64-encoded WebP thumbnail of the attachment; NULL means "not generated yet"
ALTER TABLE IF EXISTS public.attachments
    ADD COLUMN "thumbnail" text;

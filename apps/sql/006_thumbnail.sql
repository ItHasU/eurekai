-- Lazily-generated, base64-encoded WebP thumbnail of the attachment: a downscaled copy for a
-- picture, a still poster frame for a video. NULL means "not generated yet"
ALTER TABLE IF EXISTS public.attachments
    ADD COLUMN "thumbnail" text;

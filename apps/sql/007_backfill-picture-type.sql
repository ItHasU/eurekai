-- The "type" column (004_video.sql) defaults to 0 (UNKNOWN) and was never backfilled when it
-- was introduced: every attachment and completed picture generated before that migration is
-- stuck at UNKNOWN, which silently disables thumbnails for them (see thumbnail.ts, which only
-- generates a thumbnail for IMAGE or VIDEO attachments).
--
-- No video model has ever been used in this data (checked prompts.model), so it is safe to
-- backfill everything to IMAGE. Pictures without an attachment yet (PENDING, CANCELLED) are
-- left at UNKNOWN : their type is genuinely not known until generation completes.
UPDATE public.attachments SET type = 1 WHERE type = 0;
UPDATE public.pictures SET type = 1 WHERE type = 0 AND "attachmentId" IS NOT NULL;

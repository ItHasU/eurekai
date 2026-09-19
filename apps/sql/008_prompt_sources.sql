-- A prompt used to reference at most one source image, through prompts."sourceId".
-- It can now reference several sources, and their order matters : each one feeds a distinct
-- input of the workflow ($image1$, $image2$, ...). The link is therefore moved to its own table.
--
-- A source can also be a video now. The type is duplicated from the attachment because the
-- client never loads the attachments table : every source uploaded so far was an image (the
-- upload only accepted images), hence the backfill to 1 (IMAGE).
ALTER TABLE IF EXISTS public.sources
    ADD COLUMN type integer NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS public."promptSources" (
    id SERIAL PRIMARY KEY,
    "promptId" integer NOT NULL REFERENCES public.prompts(id),
    "sourceId" integer NOT NULL REFERENCES public.sources(id),
    "orderIndex" integer NOT NULL
);

-- Each prompt that had a source keeps it as its first (and only) one
INSERT INTO public."promptSources" ("promptId", "sourceId", "orderIndex")
    SELECT id, "sourceId", 0 FROM public.prompts WHERE "sourceId" IS NOT NULL;

ALTER TABLE IF EXISTS public.prompts
    DROP COLUMN "sourceId";

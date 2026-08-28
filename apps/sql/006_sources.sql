CREATE TABLE IF NOT EXISTS public.sources (
    id SERIAL PRIMARY KEY,
    "projectId" integer NOT NULL REFERENCES public.projects(id),
    "attachmentId" integer NOT NULL REFERENCES public.attachments(id),
    name text NOT NULL
);

ALTER TABLE IF EXISTS public.prompts
    ADD COLUMN "sourceId" integer REFERENCES public.sources(id);

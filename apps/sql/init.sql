-- Initialize an empty database with the current EurekAI schema.
--
-- This script creates the schema as it stands today, i.e. the result of applying
-- 001_remove-hd.sql through 006_sources.sql on top of the (undocumented) original schema.
-- Use it ONLY on a brand new, empty database. Do NOT run the numbered migrations in apps/sql/
-- afterwards, they are already reflected here.
--
-- Enum-like integer columns (see apps/shared/src/entities.ts) :
--   pictures.status / ComputationStatus : 0 NONE, 1 PENDING, 2 DONE, 3 ERROR, 4 ACCEPTED, 5 REJECTED, 6 COMPUTING, 7 CANCELLED
--   pictures.type, attachments.type / PictureType : 0 UNKNOWN, 1 IMAGE, 2 VIDEO
--   pictures.score : 0 to 4 stars
--
-- Checked against the running dev database (apps/shared/src/entities.ts is the source of truth
-- for columns, the live schema was used to confirm types/defaults) : the live schema currently has
-- no PRIMARY KEY (except users), no FOREIGN KEY, and most columns are nullable. This script adds
-- PRIMARY KEY / FOREIGN KEY / NOT NULL where the application always provides a value, on purpose :
-- a deliberate hardening over what is currently deployed, not a 1:1 dump of it.

BEGIN;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    uid text NOT NULL UNIQUE,
    "displayName" text NOT NULL,
    enabled boolean NOT NULL DEFAULT false
);

CREATE TABLE attachments (
    id SERIAL PRIMARY KEY,
    type integer NOT NULL DEFAULT 0,
    data text NOT NULL
);

CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    name text NOT NULL,
    "featuredAttachmentId" integer REFERENCES attachments(id),
    lockable boolean NOT NULL DEFAULT false,
    pinned boolean NOT NULL DEFAULT false
);

CREATE TABLE sources (
    id SERIAL PRIMARY KEY,
    "projectId" integer NOT NULL REFERENCES projects(id),
    "attachmentId" integer NOT NULL REFERENCES attachments(id),
    name text NOT NULL
);

CREATE TABLE prompts (
    id SERIAL PRIMARY KEY,
    "parentId" integer REFERENCES prompts(id),
    "projectId" integer NOT NULL REFERENCES projects(id),
    "orderIndex" integer NOT NULL,
    width integer NOT NULL,
    height integer NOT NULL,
    model text NOT NULL,
    prompt text NOT NULL,
    negative_prompt text NOT NULL,
    duration double precision,
    "sourceId" integer REFERENCES sources(id)
);

CREATE TABLE pictures (
    id SERIAL PRIMARY KEY,
    type integer NOT NULL DEFAULT 0,
    "promptId" integer NOT NULL REFERENCES prompts(id),
    seed bigint NOT NULL,
    status integer NOT NULL,
    score integer NOT NULL DEFAULT 0,
    "attachmentId" integer REFERENCES attachments(id)
);

CREATE TABLE seeds (
    id SERIAL PRIMARY KEY,
    "projectId" integer NOT NULL REFERENCES projects(id),
    seed bigint NOT NULL
);

COMMIT;

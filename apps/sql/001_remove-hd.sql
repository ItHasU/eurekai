BEGIN;
-- Move highres pictures to normal pictures
INSERT INTO "pictures" ("promptId", "seed", "status", "attachmentId", "highresStatus", "highresAttachmentId")
    SELECT "promptId", "seed", 4, "highresAttachmentId", 0, NULL -- Mark as accepted, empty highres
        FROM "pictures"
        WHERE "highresStatus" = 2;
-- Remove obsolete highres columns
ALTER TABLE "pictures" 
    DROP COLUMN "highresStatus",
    DROP COLUMN "highresAttachmentId";
COMMIT;

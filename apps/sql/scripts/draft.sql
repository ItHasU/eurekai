-- List invalid images
SELECT * FROM "pictures" WHERE 1=0
  OR ("status"=0 AND "attachmentId" IS NOT NULL)  -- NONE
  OR ("status"=1 AND "attachmentId" IS NOT NULL)  -- PENDING
  OR ("status"=2 AND "attachmentId" IS NULL)      -- DONE
  OR ("status"=3 AND "attachmentId" IS NOT NULL)  -- ERROR
  OR ("status"=4 AND "attachmentId" IS NULL)      -- ACCEPTED
  OR ("status"=5 AND "attachmentId" IS NULL)      -- REJECTED
  OR ("status"=6 AND "attachmentId" IS NOT NULL); -- COMPUTING

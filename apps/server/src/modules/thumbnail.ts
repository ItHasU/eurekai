import { AbstractSQLRunner } from "@dagda/server/sql/runner";
import { PictureType } from "@eurekai/shared/src/entities";
import sharp from "sharp";
import { qf, qt } from "./db";

/**
 * Longest side of a generated thumbnail, in pixels.
 * Large enough to stay sharp when a single picture takes the whole width of the grid,
 * small enough to be an order of magnitude lighter than the original.
 */
const THUMBNAIL_MAX_SIZE = 768;

/** WebP quality, a good size / artifact tradeoff at thumbnail scale */
const THUMBNAIL_QUALITY = 80;

/** Mime type of the generated thumbnails */
export const THUMBNAIL_MIME_TYPE = "image/webp";

/**
 * The thumbnail column is deliberately not part of APP_MODEL : it is a server side cache
 * derived from `data`, not domain data, and the client never reads the attachments table
 * through the entities layer. It is therefore quoted by hand here.
 */
const THUMBNAIL_COLUMN = `"thumbnail"`;

/**
 * Thumbnails currently being generated, keyed by attachment id.
 * Without this, a page displaying the same picture twice would resize and store it twice.
 */
const _generating: Map<number, Promise<Buffer | null>> = new Map();

/**
 * Get the thumbnail of an attachment, generating it on the first request.
 * The result is stored back in the database so the resize only happens once.
 *
 * @returns The thumbnail, or null when the attachment has none and cannot get one
 * (unknown id, video, or resize failure). Callers are expected to fall back on the
 * full size attachment in that case.
 */
export async function getOrCreateThumbnail(db: AbstractSQLRunner, attachmentId: number): Promise<Buffer | null> {
    // -- Look for an already generated thumbnail --
    // `data` is deliberately left out of this query : it holds the full size image, and
    // reading it here would defeat the whole point of serving a thumbnail.
    const row = await db.get<{ type: PictureType, thumbnail: string | null }>(
        `SELECT ${qf("attachments", "type", false)}, ${THUMBNAIL_COLUMN} FROM ${qt("attachments")} WHERE ${qf("attachments", "id", false)}=$1`,
        attachmentId);
    if (row == null) {
        return null;
    }
    if (row.thumbnail != null) {
        return Buffer.from(row.thumbnail, "base64");
    }
    if (row.type !== PictureType.IMAGE) {
        // Only still images are resized : extracting a frame from a video would need ffmpeg.
        return null;
    }

    // -- Generate it, only once for a given attachment --
    let generation = _generating.get(attachmentId);
    if (generation == null) {
        generation = _generateThumbnail(db, attachmentId).finally(() => {
            _generating.delete(attachmentId);
        });
        _generating.set(attachmentId, generation);
    }
    return generation;
}

/**
 * Resize the attachment and store the result.
 * This never throws : failing to build a thumbnail must not prevent the picture from
 * being displayed, the caller simply serves the full size image instead.
 */
async function _generateThumbnail(db: AbstractSQLRunner, attachmentId: number): Promise<Buffer | null> {
    try {
        const row = await db.get<{ data: string }>(
            `SELECT ${qf("attachments", "data", false)} FROM ${qt("attachments")} WHERE ${qf("attachments", "id", false)}=$1`,
            attachmentId);
        if (row == null) {
            return null;
        }

        const thumbnail = await sharp(Buffer.from(row.data, "base64"))
            .resize(THUMBNAIL_MAX_SIZE, THUMBNAIL_MAX_SIZE, {
                fit: "inside",          // Keep the aspect ratio, the card already enforces it
                withoutEnlargement: true // Never upscale a picture smaller than the target
            })
            .webp({ quality: THUMBNAIL_QUALITY })
            .toBuffer();

        await db.run(
            `UPDATE ${qt("attachments")} SET ${THUMBNAIL_COLUMN}=$1 WHERE ${qf("attachments", "id", false)}=$2`,
            thumbnail.toString("base64"), attachmentId);

        return thumbnail;
    } catch (e) {
        console.error(`Failed to generate thumbnail for attachment ${attachmentId}`);
        console.error(e);
        return null;
    }
}

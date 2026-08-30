import { AbstractSQLRunner } from "@dagda/server/sql/runner";
import { Queue } from "@dagda/shared/tools/queue";
import { PictureType } from "@eurekai/shared/src/entities";
import ffmpegPath from "ffmpeg-static";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { qf, qt } from "./db";

const execFileAsync = promisify(execFile);

/**
 * Longest side of a generated thumbnail, in pixels.
 * Large enough to stay sharp when a single picture takes the whole width of the grid,
 * small enough to be an order of magnitude lighter than the original.
 */
const THUMBNAIL_MAX_SIZE = 768;

/** WebP quality, a good size / artifact tradeoff at thumbnail scale */
const THUMBNAIL_QUALITY = 80;

/**
 * Where in the video the poster frame is taken, in seconds.
 * The very first frame is often black, a frame slightly in is more representative.
 */
const VIDEO_POSTER_SECONDS = 1;

/** Upper bound for a single decoded video frame handed over by ffmpeg */
const MAX_FRAME_BYTES = 64 * 1024 * 1024;

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
 * Frame extractions are run one at a time : a grid full of videos would otherwise spawn one
 * ffmpeg process per poster at once, and write as many videos to disk. Each extraction is
 * short, so queueing them costs little.
 */
const _extractionQueue: Queue = new Queue(void (0));

/**
 * What to serve for a given attachment.
 * - a Buffer when a thumbnail is available,
 * - "fallback" when the caller should serve the full size attachment instead : this only
 *   ever happens for still images, where sending the original is a fine degraded mode,
 * - null when there is nothing to serve. A video whose frame could not be extracted lands
 *   here on purpose : redirecting a poster request to the video itself would download
 *   megabytes to display a thumbnail.
 */
export type ThumbnailResult = Buffer | "fallback" | null;

/**
 * Get the thumbnail of an attachment, generating it on the first request.
 * The result is stored back in the database so the work only happens once.
 *
 * Still images are resized directly. Videos get a poster frame extracted with ffmpeg,
 * which is then resized the same way.
 */
export async function getOrCreateThumbnail(db: AbstractSQLRunner, attachmentId: number): Promise<ThumbnailResult> {
    // -- Look for an already generated thumbnail --
    // `data` is deliberately left out of this query : it holds the full size media, and
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
    if (row.type !== PictureType.IMAGE && row.type !== PictureType.VIDEO) {
        // Nothing we know how to render, and nothing worth falling back to
        return null;
    }

    // -- Generate it, only once for a given attachment --
    let generation = _generating.get(attachmentId);
    if (generation == null) {
        generation = _generateThumbnail(db, attachmentId, row.type).finally(() => {
            _generating.delete(attachmentId);
        });
        _generating.set(attachmentId, generation);
    }

    const thumbnail = await generation;
    if (thumbnail != null) {
        return thumbnail;
    }
    // Serving the original is an acceptable degraded mode for a picture, but not for a
    // video : that would send the whole file where a poster image was expected.
    return row.type === PictureType.IMAGE ? "fallback" : null;
}

/**
 * Build the thumbnail of an attachment and store it.
 * This never throws : failing to build a thumbnail must not prevent the media from being
 * displayed, the caller decides what to serve instead.
 */
async function _generateThumbnail(db: AbstractSQLRunner, attachmentId: number, type: PictureType): Promise<Buffer | null> {
    try {
        const row = await db.get<{ data: string }>(
            `SELECT ${qf("attachments", "data", false)} FROM ${qt("attachments")} WHERE ${qf("attachments", "id", false)}=$1`,
            attachmentId);
        if (row == null) {
            return null;
        }

        const source = Buffer.from(row.data, "base64");
        // A video is not an image sharp can open, extract a still frame from it first
        const image = type === PictureType.VIDEO ? await _extractVideoFrame(source) : source;
        if (image == null) {
            return null;
        }

        const thumbnail = await sharp(image)
            .resize(THUMBNAIL_MAX_SIZE, THUMBNAIL_MAX_SIZE, {
                fit: "inside",           // Keep the aspect ratio, the card already enforces it
                withoutEnlargement: true // Never upscale a media smaller than the target
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

/**
 * Extract a single still frame from a video, as PNG.
 * @returns The frame, or null if ffmpeg could not produce one.
 */
async function _extractVideoFrame(video: Buffer): Promise<Buffer | null> {
    const binary = ffmpegPath;
    if (binary == null) {
        console.error("No ffmpeg binary available, cannot extract a video frame");
        return null;
    }
    return _extractionQueue.run(() => _extractVideoFrameImpl(binary, video));
}

/** @see _extractVideoFrame, this is the queued part of it */
async function _extractVideoFrameImpl(binary: string, video: Buffer): Promise<Buffer | null> {
    // ffmpeg needs to seek inside the file, which it cannot do on a pipe for the containers
    // we deal with, so the video has to be written down first.
    const directory = await mkdtemp(join(tmpdir(), "eurekai-thumbnail-"));
    const inputPath = join(directory, "input");
    try {
        await writeFile(inputPath, video);

        // Seeking past the end of a very short video yields no frame at all, so fall back
        // on the very first one in that case.
        for (const seek of [VIDEO_POSTER_SECONDS, 0]) {
            try {
                const { stdout } = await execFileAsync(binary, [
                    "-v", "error",
                    "-ss", `${seek}`,   // Before -i, so ffmpeg seeks instead of decoding up to there
                    "-i", inputPath,
                    "-frames:v", "1",
                    "-an",              // No audio stream in the output
                    "-f", "image2pipe",
                    "-c:v", "png",
                    "pipe:1"
                ], { encoding: "buffer", maxBuffer: MAX_FRAME_BYTES });
                if (stdout.length > 0) {
                    return stdout;
                }
            } catch (e) {
                // Try the next seek position before giving up
                console.error(`ffmpeg failed to extract a frame at ${seek}s`);
                console.error(e);
            }
        }
        return null;
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
}

import { SQLHandler } from "@dagda/shared/sql/handler";
import { SQLTransaction } from "@dagda/shared/sql/transaction";
import { AppContexts, AppTables, ComputationStatus, PictureDTO, PromptDTO } from "./types";

/** 
 * Generate a certain amount of images 
 * If requested quantity is null, will generate for all preferred seeds
 */
export function generateNextPictures(handler: SQLHandler<AppTables, AppContexts>, tr: SQLTransaction<AppTables>, prompt: PromptDTO, count: number | null): void {
    // -- Get a list of preferred seeds --
    const missingPreferredSeeds: Set<number> = new Set();
    for (const seed of handler.getItems("seeds")) {
        if (handler.isSameId(seed.projectId, prompt.projectId)) {
            missingPreferredSeeds.add(seed.seed);
        }
    }

    for (const picture of handler.getItems("pictures")) {
        if (handler.isSameId(picture.promptId, prompt.id) && picture.status !== ComputationStatus.ERROR) {
            missingPreferredSeeds.delete(picture.seed);
        }
    }

    // -- Create new pictures --
    if (count === null) {
        // If count is null, just create the missing preferred seeds
        count = missingPreferredSeeds.size;
    }

    for (let i = 0; i < count; i++) {
        const newPicture: PictureDTO = {
            id: 0,
            promptId: prompt.id,
            seed: [...missingPreferredSeeds.values()][0] ?? Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
            status: ComputationStatus.PENDING,
            highresStatus: ComputationStatus.NONE
        };

        // Remove seed has it has already been handled
        // We don't care if its a preferred seed or not, the set will handle both
        missingPreferredSeeds.delete(newPicture.seed);

        tr.insert("pictures", newPicture);
    }
}

export function isPreferredSeed(handler: SQLHandler<AppTables, AppContexts>, projectId: number, seed: number): boolean {
    for (const preferredSeed of handler.getItems("seeds")) {
        if (handler.isSameId(preferredSeed.projectId, projectId) && preferredSeed.seed === seed) {
            return true;
        }
    }
    return false;
}

export function togglePreferredSeed(handler: SQLHandler<AppTables, AppContexts>, tr: SQLTransaction<AppTables>, projectId: number, seed: number): void {
    const alreadyExisting = handler.getItems("seeds").find(preferredSeed => handler.isSameId(preferredSeed.projectId, projectId) && preferredSeed.seed === seed);
    if (alreadyExisting == null) {
        // Not found, create it
        tr.insert("seeds", {
            id: 0,
            projectId,
            seed
        });
    } else {
        // Found, delete it
        tr.delete("seeds", alreadyExisting.id);
    }
}

export function deletePicture(handler: SQLHandler<AppTables, AppContexts>, tr: SQLTransaction<AppTables>, picture: PictureDTO): void {
    tr.delete("pictures", picture.id);
    if (picture.attachmentId) {
        tr.delete("attachments", picture.attachmentId);
    }
    if (picture.highresAttachmentId) {
        tr.delete("attachments", picture.highresAttachmentId)
    }
}
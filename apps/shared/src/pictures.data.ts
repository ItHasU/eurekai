import { SQLHandler } from "@dagda/shared/sql/handler";
import { SQLTransaction } from "@dagda/shared/sql/transaction";
import { AppContexts, AppTables, BooleanEnum, ComputationStatus, PictureDTO, PromptDTO } from "./types";

/** Whenever necessary, will generate new pending pictures for the prompt */
export function generateNextPicturesIfNeeded(handler: SQLHandler<AppTables, AppContexts>, tr: SQLTransaction<AppTables>, prompt: PromptDTO): void {
    if (prompt.active === BooleanEnum.FALSE) {
        return;
    }

    // -- Get a list of preferred seeds --
    const preferredSeeds: Set<number> = new Set();
    for (const seed of handler.getItems("seeds")) {
        if (seed.projectId === prompt.projectId) {
            preferredSeeds.add(seed.seed);
        }
    }
    // -- Count images pending --
    const pendingImages: PictureDTO[] = [];
    for (const picture of handler.getItems("pictures")) {
        if (picture.promptId === prompt.id) {
            if (picture.status <= ComputationStatus.PENDING) {
                pendingImages.push(picture);
            }
            // Remove seed has it has already been handled
            // We don't care if its a preferred seed or not, the set will handle both
            preferredSeeds.delete(picture.seed);
        }
    }

    // -- Create new pictures --
    while (pendingImages.length < prompt.bufferSize) {
        const newPicture: PictureDTO = {
            id: 0,
            promptId: prompt.id,
            seed: [...preferredSeeds.values()][0] ?? Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
            status: ComputationStatus.PENDING,
            highresStatus: ComputationStatus.NONE
        };

        // Remove seed has it has already been handled
        // We don't care if its a preferred seed or not, the set will handle both
        preferredSeeds.delete(newPicture.seed);

        tr.insert("pictures", newPicture);
        pendingImages.push(newPicture);
    }
}

export function isPreferredSeed(handler: SQLHandler<AppTables, AppContexts>, projectId: number, seed: number): boolean {
    for (const preferredSeed of handler.getItems("seeds")) {
        if (preferredSeed.projectId === projectId && preferredSeed.seed === seed) {
            return true;
        }
    }
    return false;
}

export function togglePreferredSeed(handler: SQLHandler<AppTables, AppContexts>, tr: SQLTransaction<AppTables>, projectId: number, seed: number): void {
    const alreadyExisting = handler.getItems("seeds").find(preferredSeed => preferredSeed.projectId === projectId && preferredSeed.seed === seed);
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
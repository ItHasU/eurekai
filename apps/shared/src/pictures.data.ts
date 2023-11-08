import { SQLHandler } from "@dagda/shared/sql/handler";
import { SQLTransaction } from "@dagda/shared/sql/transaction";
import { AppContexts, AppTables, ComputationStatus, PictureDTO, PromptDTO } from "./types";

/** Generate a certain amount of images */
export function generateNextPictures(handler: SQLHandler<AppTables, AppContexts>, tr: SQLTransaction<AppTables>, prompt: PromptDTO, count: number): void {
    // -- Get a list of preferred seeds --
    const preferredSeeds: Set<number> = new Set();
    for (const seed of handler.getItems("seeds")) {
        if (seed.projectId === prompt.projectId) {
            preferredSeeds.add(seed.seed);
        }
    }

    // -- Create new pictures --
    for (let i = 0; i < count; i++) {
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
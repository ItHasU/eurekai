import { EntitiesHandler } from "@dagda/shared/entities/handler";
import { asNamed } from "@dagda/shared/entities/named.types";
import { SQLTransaction } from "@dagda/shared/sql/transaction";
import { AppContexts, AppTables, AttachmentId, ComputationStatus, PictureEntity, PictureId, ProjectId, PromptEntity, PromptId, Seed, SeedId } from "./entities";

/** 
 * Generate a certain amount of images 
 * If requested quantity is null, will generate for all preferred seeds
 */
export function generateNextPictures(handler: EntitiesHandler<AppTables, AppContexts>, tr: SQLTransaction<AppTables, AppContexts>, prompt: PromptEntity, count: number | null): void {
    // -- Get a list of preferred seeds --
    const missingPreferredSeeds: Set<Seed> = new Set();
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
        const newPicture: PictureEntity = {
            id: asNamed(0),
            promptId: prompt.id,
            seed: [...missingPreferredSeeds.values()][0] ?? Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
            status: asNamed(ComputationStatus.PENDING),
            attachmentId: null,
            highresStatus: asNamed(ComputationStatus.NONE),
            highresAttachmentId: null
        };

        // Remove seed has it has already been handled
        // We don't care if its a preferred seed or not, the set will handle both
        missingPreferredSeeds.delete(newPicture.seed);

        tr.insert("pictures", newPicture);
    }
}

export function isPreferredSeed(handler: EntitiesHandler<AppTables, AppContexts>, projectId: ProjectId, seed: number): boolean {
    for (const preferredSeed of handler.getItems("seeds")) {
        if (handler.isSameId(preferredSeed.projectId, projectId) && preferredSeed.seed === seed) {
            return true;
        }
    }
    return false;
}

export function togglePreferredSeed(handler: EntitiesHandler<AppTables, AppContexts>, tr: SQLTransaction<AppTables, AppContexts>, projectId: ProjectId, seed: Seed): void {
    const alreadyExisting = handler.getItems("seeds").find(preferredSeed => handler.isSameId(preferredSeed.projectId, projectId) && preferredSeed.seed === seed);
    if (alreadyExisting == null) {
        // Not found, create it
        tr.insert("seeds", {
            id: asNamed(0),
            projectId,
            seed
        });
    } else {
        // Found, delete it
        tr.delete("seeds", alreadyExisting.id);
    }
}

export function deletePicture(handler: EntitiesHandler<AppTables, AppContexts>, tr: SQLTransaction<AppTables, AppContexts>, picture: PictureEntity): void {
    tr.delete("pictures", picture.id);
    if (picture.attachmentId) {
        tr.delete("attachments", picture.attachmentId);
    }
    if (picture.highresAttachmentId) {
        tr.delete("attachments", picture.highresAttachmentId)
    }
}

export function updateSeeds(handler: EntitiesHandler<AppTables, AppContexts>, tr: SQLTransaction<AppTables, AppContexts>, prompt: PromptEntity, addNewSeeds: boolean): void {
    const preferredSeeds = new Set<Seed>();
    for (const picture of handler.getItems("pictures")) {
        if (handler.isSameId(picture.promptId, prompt.id)) {
            if (picture.status === ComputationStatus.ACCEPTED) {
                preferredSeeds.add(picture.seed);
            }
        }
    }

    // Only keep the seeds that are in the preferred seeds
    const existingSeeds = new Set<Seed>();
    for (const seed of handler.getItems("seeds")) {
        if (handler.isSameId(seed.projectId, prompt.projectId)) {
            if (!preferredSeeds.has(seed.seed)) {
                tr.delete("seeds", seed.id);
            } else {
                existingSeeds.add(seed.seed);
            }
        }
    }

    // Add the new seeds
    if (addNewSeeds) {
        for (const seed of preferredSeeds) {
            if (!existingSeeds.has(seed)) {
                tr.insert("seeds", {
                    id: asNamed(0),
                    projectId: prompt.projectId,
                    seed
                });
            }
        }
    }
}

/** Delete all data from a project */
export function deleteProject(handler: EntitiesHandler<AppTables, AppContexts>, tr: SQLTransaction<AppTables, AppContexts>, projectId: ProjectId): void {
    const promptIds: Set<PromptId> = new Set();
    for (const prompt of handler.getItems("prompts")) {
        if (handler.isSameId(prompt.projectId, projectId)) {
            promptIds.add(prompt.id);
        }
    }
    const seedIds: Set<SeedId> = new Set();
    for (const seed of handler.getItems("seeds")) {
        if (handler.isSameId(seed.projectId, projectId)) {
            seedIds.add(seed.id);
        }
    }

    const pictureIds: Set<PictureId> = new Set();
    const attachmentIds: Set<AttachmentId> = new Set();
    for (const picture of handler.getItems("pictures")) {
        if (promptIds.has(picture.promptId)) {
            // Here we don't care about same id as we used the ids of the prompts themselves
            pictureIds.add(picture.id);
            if (picture.attachmentId != null) {
                attachmentIds.add(picture.attachmentId);
            }
            if (picture.highresAttachmentId != null) {
                attachmentIds.add(picture.highresAttachmentId);
            }
        }
    }

    for (const pictureId of pictureIds) {
        tr.delete("pictures", pictureId);
        // Cleans references of the prompts and attachments
    }
    for (const attachmentId of attachmentIds) {
        tr.delete("attachments", attachmentId);
    }
    for (const promptId of promptIds) {
        tr.delete("prompts", promptId);
        // Cleans references to the project
    }
    for (const seedId of seedIds) {
        tr.delete("seeds", seedId);
        // Cleans references to the project
    }
    tr.delete("projects", projectId);
}
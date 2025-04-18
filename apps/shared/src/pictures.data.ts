import { EntitiesHandler } from "@dagda/shared/entities/handler";
import { asNamed } from "@dagda/shared/entities/named.types";
import { SQLTransaction } from "@dagda/shared/sql/transaction";
import JSZip from "jszip";
import { AppContexts, AppTables, AttachmentId, ComputationStatus, PictureEntity, PictureId, ProjectEntity, ProjectId, PromptEntity, PromptId, Seed, SeedEntity, SeedId } from "./entities";

/** 
 * Generate a certain amount of images 
 * If requested quantity is not null, will generate random images
 * If requested quantity is null, will generate for all preferred seeds
 */
export function generateNextPictures(handler: EntitiesHandler<AppTables, AppContexts>, tr: SQLTransaction<AppTables, AppContexts>, prompt: PromptEntity, count: number | "preferred", firstSeed?: Seed): void {
    // -- Generate the list of seeds to create --
    const seeds: Seed[] = [];

    if (count === "preferred") {
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

        seeds.push(...missingPreferredSeeds);
    } else {
        // -- Generate random seeds --
        for (let i = 0; i < count; i++) {
            seeds.push(firstSeed ?? asNamed(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)));
            if (firstSeed != null) {
                firstSeed++;
            }
        }
    }


    for (const seed of seeds) {
        const newPicture: PictureEntity = {
            id: asNamed(0),
            promptId: prompt.id,
            seed: asNamed(seed),
            status: asNamed(ComputationStatus.PENDING),
            score: asNamed(0),
            attachmentId: null
        };

        tr.insert("pictures", newPicture);
    }

    // Mark project as pinned when new pictures are added. This makes the project easier to find.
    if (seeds.length > 0) {
        const project: ProjectEntity | undefined = handler.getById("projects", prompt.projectId);
        if (project != null) {
            tr.update("projects", project, { pinned: asNamed(true) });
        }
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

export function unstarPicture(handler: EntitiesHandler<AppTables, AppContexts>, tr: SQLTransaction<AppTables, AppContexts>, picture: PictureEntity): void {
    tr.update("pictures", picture, { score: asNamed(0) });
}

export function deletePicture(handler: EntitiesHandler<AppTables, AppContexts>, tr: SQLTransaction<AppTables, AppContexts>, picture: PictureEntity): void {
    tr.delete("pictures", picture.id);
    if (picture.attachmentId) {
        tr.delete("attachments", picture.attachmentId);
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

function _getProjectEntities(handler: EntitiesHandler<AppTables, AppContexts>, projectId: ProjectId): { prompts: PromptEntity[], pictures: PictureEntity[], seeds: SeedEntity[] } {
    // -- Prompts --
    const prompts: PromptEntity[] = [];
    const promptIds: Set<PromptId> = new Set();
    for (const prompt of handler.getItems("prompts")) {
        if (handler.isSameId(prompt.projectId, projectId)) {
            promptIds.add(prompt.id);
            prompts.push(prompt);
        }
    }

    const pictures: PictureEntity[] = [];
    for (const picture of handler.getItems("pictures")) {
        if (promptIds.has(picture.promptId)) {
            pictures.push(picture);
        }
    }

    const seeds: SeedEntity[] = [];
    for (const seed of handler.getItems("seeds")) {
        if (handler.isSameId(seed.projectId, projectId)) {
            seeds.push(seed);
        }
    }
    return { prompts, pictures, seeds };
}

export async function zipPictures(
    handler: EntitiesHandler<AppTables, AppContexts>,
    projectId: ProjectId,
    download: (AttachmentId: AttachmentId) => Promise<Blob>,
    filter?: (picture: PictureEntity) => boolean,
): Promise<JSZip> {
    const { pictures } = _getProjectEntities(handler, projectId);

    const zip = new JSZip();
    for (const picture of pictures) {
        if (!picture.attachmentId) {
            // No attachment, skip
            continue;
        }

        const keepPicture = filter?.(picture) ?? true;
        if (!keepPicture) {
            // Skip this picture
            continue;
        }

        const baseFilename = `${picture.id}`;

        // -- Add sd picture to zip --
        if (picture.attachmentId != null) {
            try {
                const data = await download(picture.attachmentId);
                // Add picture as png to zip
                zip.file(`${baseFilename}-sd.png`, data, { binary: true });
            } catch (e) {
                console.error(e);
            }
        }
    }

    return zip;
}

/** Delete a prompt */
export function deletePrompt(handler: EntitiesHandler<AppTables, AppContexts>, tr: SQLTransaction<AppTables, AppContexts>, prompt: PromptEntity): void {
    // -- Delete this prompt pictures --
    for (const picture of handler.getItems("pictures")) {
        if (handler.isSameId(picture.promptId, prompt.id)) {
            deletePicture(handler, tr, picture);
        }
    }
    // -- Unlink this prompt from its children --
    for (const child of handler.getItems("prompts")) {
        if (handler.isSameId(child.parentId, prompt.id)) {
            tr.update("prompts", child, { parentId: null });
        }
    }
    // -- Delete the prompt itself --
    tr.delete("prompts", prompt.id);
}

/** Will move the firstPrompt and all its children and sub-children to the newProjectId */
export function movePromptToProject(handler: EntitiesHandler<AppTables, AppContexts>, tr: SQLTransaction<AppTables, AppContexts>, firstPrompt: PromptEntity, newProjectId: ProjectId, withChildren: boolean): PromptEntity[] {
    const prompts = [...handler.getItems("prompts")];
    prompts.sort((a, b) => (a.id - b.id));

    if (withChildren) {
        // -- Make the list of prompts to move --
        const promptsToMove: Set<PromptEntity> = new Set([firstPrompt]);
        let added = false;
        for (const prompt of prompts) {
            const parentPrompt = prompt.parentId == null ? null : handler.getById("prompts", prompt.parentId);
            if (parentPrompt != null && promptsToMove.has(parentPrompt)) {
                if (promptsToMove.has(prompt)) {
                    // Prompt is already in the list, skip
                } else {
                    added = true;
                    promptsToMove.add(prompt);
                }
            }
        }
        for (const prompt of promptsToMove) {
            tr.update("prompts", prompt, { projectId: newProjectId });
        }
        tr.update("prompts", firstPrompt, { parentId: null });
        return [...promptsToMove];
    } else {
        tr.update("prompts", firstPrompt, { projectId: newProjectId });
        for (const prompt of prompts) {
            if (handler.isSameId(prompt.parentId, firstPrompt.id)) {
                tr.update("prompts", prompt, { parentId: null });
            }
        }
        tr.update("prompts", firstPrompt, { parentId: null });
        return [firstPrompt];
    }

}

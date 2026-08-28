import { AbstractSQLRunner } from "@dagda/server/sql/runner";
import { asNamed } from "@dagda/shared/entities/named.types";
import { SQLTransaction } from "@dagda/shared/sql/transaction";
import { NotificationHelper } from "@dagda/shared/tools/notification.helper";
import { AppContexts, AppTables, ComputationStatus, PICTURE_TYPE, PictureEntity, PictureType, PromptEntity } from "@eurekai/shared/src/entities";
import { AppEvents } from "@eurekai/shared/src/events";
import { DiffusersRegistry } from "src/diffusers";
import { AbstractDiffuser, ImageDescription } from "src/diffusers/diffuser";
import { qf, qt } from "./db";
import { buildServerEntitiesHandler } from "./entities.handler";

export class Generator {
    /** Handler for querying the database */
    protected _handler: ReturnType<typeof buildServerEntitiesHandler>;
    /** 
     * Map of last promise for each lock.
     * When registered, the promise will have an empty catch method allowing to make sure promises can be queued.
     */
    protected readonly _lastPromiseByLock: Map<string, Promise<void>> = new Map();
    /** 
     * Ids of the pictures handled by the generator : the ones waiting for a lock and the one
     * being generated. This is what the "generating" notification counts, so the badge shows
     * everything that is left to do, not only the picture currently being generated.
     */
    protected readonly _queuedPictureIds: Set<number> = new Set();

    constructor(protected _db: AbstractSQLRunner) {
        this._handler = buildServerEntitiesHandler(this._db);
        // -- Answer to clients asking for the current count --
        // Without this, a client connecting during a long generation would have to wait
        // for the current picture to end before getting the count.
        // Note : the request is also relayed to the other clients, they simply ignore it.
        NotificationHelper.on<AppEvents, "generatingRefresh">("generatingRefresh", () => {
            this._notifyQueuedPictureCount();
        });
        this._dequeue();
    }

    /** Broadcast the current count of queued pictures to all the clients */
    protected _notifyQueuedPictureCount(): void {
        NotificationHelper.broadcast<AppEvents, "generating">("generating", { count: this._queuedPictureIds.size });
    }

    /** Fetch data and queue them for computation */
    protected async _dequeue(): Promise<void> {
        try {
            // -- Fetch data --
            this._handler.markCacheDirty();
            await this._handler.fetch({ type: "pending", options: undefined });

            // -- List pending pictures not queued yet --
            // A picture stays PENDING until it really starts being generated (see _queuePicture),
            // so the same picture must not be handed to _queuePicture more than once : the ids
            // already queued are tracked in _queuedPictureIds instead.
            const picturesToQueue = this._handler.getItems("pictures").filter(pic =>
                pic.status === asNamed(ComputationStatus.PENDING) && !this._queuedPictureIds.has(pic.id));
            if (picturesToQueue.length === 0) {
                // Shortcut to exit on no new picture to generate
                if (this._queuedPictureIds.size <= 0) {
                    // Just in case, we send 0 for client that may have lost connection
                    this._notifyQueuedPictureCount();
                }
                return;
            }

            // -- Sort pictures --
            picturesToQueue.sort((p1, p2) => {
                let res: number = 0;
                if (res === 0) {
                    // Compare by model to limit the switch of diffuser
                    const prompt1 = this._handler.getById("prompts", p1.promptId);
                    const prompt2 = this._handler.getById("prompts", p2.promptId);
                    if (prompt1 != null && prompt2 != null) {
                        res = prompt1.model.localeCompare(prompt2.model);
                    }
                }

                if (res === 0) {
                    // Then sort by creation date
                    res = p1.id - p2.id;
                }
                return res;
            });

            // Generate all lowres pictures
            for (const picture of picturesToQueue) {
                // Don't wait for this promise, all images are rendered in individual transaction
                // so that they can be viewed as soon as possible by the user.
                this._queuePicture(picture);
            }
            // Notify once for the whole batch : clients must see the new pictures right away,
            // not only once the first one finishes.
            this._notifyQueuedPictureCount();
        } catch (e) {
            console.error("Failed to process pictures");
            console.error(e);
        } finally {
            // Re-schedule next
            setTimeout(this._dequeue.bind(this), 1000);
        }
    }

    /** This is a failsafe method that will queue the picture based on the lock of the model */
    protected _queuePicture(picture: PictureEntity): void {
        // This method cannot fail
        try {
            // Registered here, synchronously, so the next tick cannot queue it twice
            this._queuedPictureIds.add(picture.id);

            // -- Get data in the cache ---------------------------------------
            // -- Get the prompt --
            const prompt = this._handler.getById("prompts", picture.promptId);
            if (prompt == null) {
                // Report error
                throw `Failed to get prompt for picture ${picture.id}`;
            }
            // -- Get the diffuser --
            const diffuser = DiffusersRegistry.getModel(prompt.model);
            if (diffuser == null) {
                // Report error
                throw `Failed to get the diffuser named ${prompt.model} for picture ${picture.id}`;
            }

            // -- Prepare the image --
            const modelInfo = diffuser.getModelInfo();
            if (modelInfo.image === true && prompt.sourceId == null) {
                throw `Model ${prompt.model} requires a source image for picture ${picture.id}`;
            }
            const img: ImageDescription = {
                width: prompt.width,
                height: prompt.height,
                prompt: prompt.prompt,
                negative_prompt: prompt.negative_prompt ?? "",
                seed: picture.seed,
                // Prompts created before the option existed have no duration, fallback on the
                // model default so the workflow keeps working. The key must always be set,
                // otherwise the $duration$ token would be left as-is in the template.
                duration: prompt.duration ?? modelInfo.duration?.default ?? null
            };

            // -- Now, queue the picture --------------------------------------
            // Once everything is ready, we get the lock and queue the generation

            // -- Handle generation queueing based on lock --
            const lock = diffuser.getLock(img);
            const previousPromise: Promise<void> = lock == null ? Promise.resolve() : (this._lastPromiseByLock.get(lock) ?? Promise.resolve());

            // -- Queue the generation of the picture --
            const nextPromise = previousPromise.then(async () => {
                try {
                    await this._handler.withTransaction(async (tr) => {
                        try {
                            // -- Manually add the context so clients get notified --
                            tr.contexts.push({
                                type: "project",
                                options: {
                                    projectId: prompt.projectId
                                }
                            });

                            // Start the main transaction
                            // The user may have cancelled the picture while it was waiting behind the lock
                            if (await this._isCancelled(picture)) {
                                console.log(`Picture ${picture.id} was cancelled, skipping generation`);
                                return;
                            }

                            // -- Picture generation --------------------------------------
                            // Mark the picture has being generated
                            await this._handler.withTransaction((statusTr) => {
                                statusTr.update("pictures", picture, { status: asNamed(ComputationStatus.COMPUTING) });
                                // Do not push context, we don't want to notify the user, it is pretty annoying
                                // statusTr.contexts.push({ type: "project", options: { projectId: prompt.projectId } });
                            });

                            // Generate the picture
                            await this._generatePictureImpl(tr, diffuser, picture, prompt, img);
                        } catch (e) {
                            // Image generation failed, try to mark picture as failed
                            console.error(`Failed to generate image for picture ${picture.id}`);
                            console.error(e);
                            try {
                                tr.update("pictures", picture, {
                                    status: asNamed(ComputationStatus.ERROR)
                                });
                            } catch (e) {
                                console.error(e);
                            }
                        }
                    });
                } catch (e) {
                    console.error(`An error occurred while handing picture ${picture.id}`);
                    console.error(e);
                } finally {
                    // Whatever happens, the picture can now be considered as unqueued
                    this._queuedPictureIds.delete(picture.id);
                    this._notifyQueuedPictureCount();
                }
            });

            if (lock != null) {
                this._lastPromiseByLock.set(lock, nextPromise.catch(() => { })); // Don't care for errors here
            }
        } catch (e) {
            console.error(`An error occurred while queueing the picture ${picture.id}`);
            console.error(e);

            this._handler.withTransaction(async (tr) => {
                tr.update("pictures", picture, {
                    status: asNamed(ComputationStatus.ERROR)
                });
            }).catch(e => console.error(e)).then(() => {
                this._queuedPictureIds.delete(picture.id);
                this._notifyQueuedPictureCount();
            });
        }
    }

    /** @returns true if the user cancelled the picture since it was queued */
    protected async _isCancelled(picture: PictureEntity): Promise<boolean> {
        try {
            const row = await this._db.get<Pick<PictureEntity, "status">>(
                `SELECT ${qf("pictures", "status", false)} FROM ${qt("pictures")} WHERE ${qf("pictures", "id", false)}=$1`,
                picture.id);
            return row?.status === ComputationStatus.CANCELLED;
        } catch (e) {
            // On error, generate the picture : losing an image is worse than generating one too many
            console.error(`Failed to check cancellation for picture ${picture.id}`);
            console.error(e);
            return false;
        }
    }

    /** 
     * This is the real image generation process.
     * This function call is queued by the _queuePicture method depending on the model lock.
     */
    protected async _generatePictureImpl(tr: SQLTransaction<AppTables, AppContexts>, diffuser: AbstractDiffuser, picture: PictureEntity, prompt: PromptEntity, img: ImageDescription): Promise<void> {
        // -- Resolve the source image, if any --
        // Not done in _queuePicture : the generator's entities cache is only populated by the
        // "pending" fetch context, which does not load "sources" (see sqlFetch), and the blob
        // must not transit through that generic cache anyway (same rule as attachments).
        if (prompt.sourceId != null) {
            const row = await this._db.get<{ data: string }>(
                `SELECT ${qf("attachments", "data")} AS data
                 FROM ${qt("sources")}
                 JOIN ${qt("attachments")} ON ${qf("sources", "attachmentId")} = ${qf("attachments", "id")}
                 WHERE ${qf("sources", "id")} = $1`,
                prompt.sourceId);
            img.image = row?.data ?? null;
        }

        // -- Generate the image --
        console.debug(`Generating picture ${picture.id} with model ${prompt.model} and seed ${picture.seed}`);
        const imageData = await diffuser.txt2img(img);

        // For debugging purpose, write image to disk
        // await writeFile(`${new Date().getTime()}.png`, Buffer.from(imageData, 'base64'));

        // -- Save --
        // We mark both picture and attachment. Picture for client display and attachment for mime-type
        const type: PICTURE_TYPE = asNamed(diffuser.getModelInfo().video === true ? PictureType.VIDEO : PictureType.IMAGE);

        const attachment = tr.insert("attachments", {
            id: asNamed(0),
            type,
            data: imageData.data
        });

        tr.update("pictures", picture, {
            status: asNamed(ComputationStatus.DONE),
            type,
            attachmentId: attachment.id
        });
        if (imageData.revisedWidth != null) {
            tr.update("prompts", prompt, {
                width: asNamed(imageData.revisedWidth)
            });
        }
        if (imageData.revisedHeight != null) {
            tr.update("prompts", prompt, {
                height: asNamed(imageData.revisedHeight)
            });
        }
    }
}
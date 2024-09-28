import { AbstractSQLRunner } from "@dagda/server/sql/runner";
import { asNamed } from "@dagda/shared/entities/named.types";
import { SQLTransaction } from "@dagda/shared/sql/transaction";
import { NotificationHelper } from "@dagda/shared/tools/notification.helper";
import { AppContexts, AppTables, ComputationStatus, PictureEntity, PromptEntity } from "@eurekai/shared/src/entities";
import { AppEvents } from "@eurekai/shared/src/events";
import { DiffusersRegistry } from "src/diffusers";
import { AbstractDiffuser, ImageDescription } from "src/diffusers/diffuser";
import { buildServerEntitiesHandler } from "./entities.handler";

export class Generator {
    /** Handler for querying the database */
    protected _handler: ReturnType<typeof buildServerEntitiesHandler>;
    /** 
     * Map of last promise for each lock.
     * When registered, the promise will have an empty catch method allowing to make sure promises can be queued.
     */
    protected readonly _lastPromiseByLock: Map<string, Promise<void>> = new Map();
    /** Count pictures currently waiting to be generated */
    protected _queuedPictureCount: number = 0;

    constructor(protected _db: AbstractSQLRunner) {
        this._handler = buildServerEntitiesHandler(this._db);
        this._dequeue();
    }

    /** Fetch data and queue them for computation */
    protected async _dequeue(): Promise<void> {
        try {
            // -- Fetch data --
            this._handler.markCacheDirty();
            await this._handler.fetch({ type: "pending", options: undefined });

            // -- List pending pictures --
            const picturesPending = this._handler.getItems("pictures").filter(pic => pic.status === asNamed(ComputationStatus.PENDING)); // Filter old pictures in cache
            if (picturesPending.length === 0) {
                // Shortcut to exit on no new picture to generate
                if (this._queuedPictureCount <= 0) {
                    // Just in case, we send 0 for client that may have lost connection
                    NotificationHelper.broadcast<AppEvents>("generating", { count: 0 });
                }
                return;
            }

            // -- Mark pending prompt as computing --
            // This is a failsafe code that will mark all pictures as computing.
            // This avoids pictures to be computed once more by _dequeue on the next call.
            await this._handler.withTransaction(async (tr) => {
                for (const picture of picturesPending) {
                    try {
                        tr.update("pictures", picture, {
                            status: asNamed(ComputationStatus.COMPUTING),
                        });
                    } catch (e) {
                        console.error(`Failed to mark picture as computing ${picture.id}`);
                        console.error(e);
                        try {
                            tr.update("pictures", picture, {
                                status: asNamed(ComputationStatus.ERROR)
                            });
                        } catch (e) {
                            console.error(`Failed to update status for picture ${picture.id}`);
                            console.error(e);
                        }
                    }
                }
            });
            // Here we make sure all images have been marked to avoid restarting the computation
            // on the next queue. In fact, the cache will be marked dirty automatically on the next
            // call the _dequeue and sometime the SQL server can be a little slow and modifications
            // are not finished in the 1s timelapse.
            await this._handler.waitForSubmit();

            // -- Sort pictures --
            picturesPending.sort((p1, p2) => {
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
            for (const picture of picturesPending) {
                if (picture.status !== ComputationStatus.COMPUTING) {
                    // An error may have occurred
                    continue;
                }
                // Don't wait for this promise, all images are rendered in individual transaction
                // so that they can be viewed as soon as possible by the user.
                this._queuePicture(picture).catch(e => console.error(e));
            }
        } catch (e) {
            console.error("Failed to process pictures");
            console.error(e);
        } finally {
            // Re-schedule next
            setTimeout(this._dequeue.bind(this), 1000);
        }
    }

    /** This is a failsafe method that will queue the picture based on the lock of the model */
    protected async _queuePicture(picture: PictureEntity): Promise<void> {
        await this._handler.withTransaction(async (tr) => {
            // -- Notify the clients we are at work --
            // We notify on each image for newly connected clients
            this._queuedPictureCount++;
            NotificationHelper.broadcast<AppEvents>("generating", { count: this._queuedPictureCount });

            try {
                // -- Get the prompt --
                const prompt = this._handler.getById("prompts", picture.promptId);
                if (prompt == null) {
                    // Report error
                    throw `Failed to get prompt for picture ${picture.id}`;
                }

                // -- Manually add the context so clients get notified --
                tr.contexts.push({
                    type: "project",
                    options: {
                        projectId: prompt.projectId
                    }
                });

                // -- Get the diffuser --
                const diffuser = DiffusersRegistry.getModel(prompt.model);
                if (diffuser == null) {
                    // Report error
                    throw `Failed to get the diffuser named ${prompt.model} for picture ${picture.id}`;
                }

                // -- Prepare the image --
                const img: ImageDescription = {
                    width: prompt.width,
                    height: prompt.height,
                    prompt: prompt.prompt,
                    negative_prompt: prompt.negative_prompt ?? "",
                    seed: picture.seed
                };

                // -- Handle generation queueing based on lock --
                const lock = diffuser.getLock(img);
                const previousPromise: Promise<void> = lock == null ? Promise.resolve() : (this._lastPromiseByLock.get(lock) ?? Promise.resolve());

                // Queue the generation of the picture
                const nextPromise = previousPromise.then(this._generatePictureImpl.bind(this, tr, diffuser, picture, prompt, img));
                if (lock != null) {
                    this._lastPromiseByLock.set(lock, nextPromise.catch(() => { })); // Don't care for errors here
                }
                await nextPromise;
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
            } finally {
                this._queuedPictureCount--;
                if (this._queuedPictureCount <= 0) {
                    this._queuedPictureCount = 0; // Failsafe if we decrease too much
                }
                NotificationHelper.broadcast<AppEvents>("generating", { count: this._queuedPictureCount });
            }
        });
        // Here, no need to wait for the transaction to be done.
        // The client will automatically be notified when the SQL transaction is finished.
    }

    /** 
     * This is the real image generation process.
     * This function call is queued by the _queuePicture method depending on the model lock.
     */
    protected async _generatePictureImpl(tr: SQLTransaction<AppTables, AppContexts>, diffuser: AbstractDiffuser, picture: PictureEntity, prompt: PromptEntity, img: ImageDescription): Promise<void> {
        // -- Generate the image --
        console.debug(`Generating picture ${picture.id} with model ${prompt.model} and seed ${picture.seed}`);
        const imageData = await diffuser.txt2img(img);

        // For debugging purpose, write image to disk
        // await writeFile(`${new Date().getTime()}.png`, Buffer.from(imageData, 'base64'));

        // -- Save --
        const attachment = tr.insert("attachments", {
            id: asNamed(0),
            data: imageData.data
        });

        tr.update("pictures", picture, {
            status: asNamed(ComputationStatus.DONE),
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
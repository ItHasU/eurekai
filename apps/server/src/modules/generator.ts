import { AbstractSQLRunner } from "@dagda/server/sql/runner";
import { asNamed } from "@dagda/shared/entities/named.types";
import { ComputationStatus, PictureEntity } from "@eurekai/shared/src/entities";
import { DiffusersRegistry } from "src/diffusers";
import { ImageDescription } from "src/diffusers/diffuser";
import { buildServerEntitiesHandler } from "./entities.handler";

export class Generator {
    protected _handler: ReturnType<typeof buildServerEntitiesHandler>;

    constructor(protected _db: AbstractSQLRunner<any, any>) {
        this._handler = buildServerEntitiesHandler(this._db);
        this._unqueue();
    }

    protected async _unqueue(): Promise<boolean> {
        try {
            // -- Fetch data --
            this._handler.markCacheDirty();
            await this._handler.fetch({ type: "pending", options: undefined });

            // -- Handle pending lowres pictures --
            const picturesPending = this._handler.getItems("pictures"); // No need to filter, we only fetch the pending ones with the selected context
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
                    // Render lowres images first
                    const lowres1 = p1.status === ComputationStatus.PENDING ? 0 : 1;
                    const lowres2 = p2.status === ComputationStatus.PENDING ? 0 : 1;

                    res = lowres1 - lowres2;
                }

                if (res === 0) {
                    // Then sort by creation date
                    res = p1.id - p2.id;
                }
                return res;
            });

            // Generate all lowres pictures
            for (const picture of picturesPending) {
                // Both renderings are done in separate transactions
                // so that the client can see each image asap

                // Render the lowres image if needed
                if (picture.status === ComputationStatus.PENDING) {
                    await this._generatePicture(picture, false);
                }

                // Render the highres image if needed
                if (picture.highresStatus === ComputationStatus.PENDING) {
                    await this._generatePicture(picture, true);
                }
            }

            return picturesPending.length > 0;
        } catch (e) {
            console.error("Failed to process pictures");
            console.error(e);
            return false;
        } finally {
            // Re-schedule next
            setTimeout(this._unqueue.bind(this), 5000);
        }
    }

    /** Generate a picture and save it to the picture */
    protected async _generatePicture(picture: PictureEntity, highres: boolean): Promise<void> {
        await this._handler.withTransaction(async (tr) => {
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

                // -- Generate the image --
                const img: ImageDescription = {
                    width: prompt.width,
                    height: prompt.height,
                    prompt: prompt.prompt,
                    negative_prompt: prompt.negative_prompt ?? "",
                    seed: picture.seed
                };
                console.debug(`Generating ${highres ? "highres" : "lowres"} image for picture ${picture.id} with model ${prompt.model} and seed ${picture.seed}`);
                const imageData = await diffuser.txt2img(img, highres);

                // For debugging purpose, write image to disk
                // await writeFile(`${new Date().getTime()}.png`, Buffer.from(imageData, 'base64'));

                // -- Save --
                const attachment = tr.insert("attachments", {
                    id: asNamed(0),
                    data: imageData.data
                });

                if (highres) {
                    tr.update("pictures", picture, {
                        highresStatus: asNamed(ComputationStatus.DONE),
                        highresAttachmentId: attachment.id
                    });
                } else {
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
            } catch (e) {
                console.error(`Failed to generate image for picture ${picture.id}`);
                console.error(e);
                if (highres) {
                    tr.update("pictures", picture, {
                        highresStatus: asNamed(ComputationStatus.ERROR)
                    });
                } else {
                    tr.update("pictures", picture, {
                        status: asNamed(ComputationStatus.ERROR)
                    });
                }
            }
        });
    }

}
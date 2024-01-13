import { AbstractSQLRunner } from "@dagda/server/sql/runner";
import { asNamed } from "@dagda/shared/entities/named.types";
import { ComputationStatus } from "@eurekai/shared/src/entities";
import { DiffusersRegistry } from "src/diffusers";
import { ImageDescription } from "src/diffusers/diffuser";
import { buildServerEntitiesHandler } from "./entities.handler";

export class Generator {
    protected _stopOnNextTimeout: boolean = false;
    protected _handler: ReturnType<typeof buildServerEntitiesHandler>;

    constructor(protected _db: AbstractSQLRunner<any, any>) {
        this._handler = buildServerEntitiesHandler(this._db);
        this._scheduleNextIfNeeded();
    }

    public stop(): void {
        this._stopOnNextTimeout = true;
    }

    protected async _unqueue(): Promise<boolean> {
        // -- Fetch data --
        await this._handler.fetch({ type: "pending", options: undefined });

        // -- Handle pending lowres pictures --
        const lowresPicturesPending = this._handler.getItems("pictures").filter(p => p.status === ComputationStatus.PENDING);
        if (lowresPicturesPending.length === 0) {
            // We are out of stock, make sure we reload next time
            this._handler.markCacheDirty();
        } else {
            // Generate all lowres pictures
            for (const picture of lowresPicturesPending) {
                // -- Get the prompt --
                const prompt = this._handler.getById("prompts", picture.promptId);
                if (prompt == null) {
                    // Report error
                    console.error(`Failed to get prompt for picture ${picture.id}`);
                    await this._handler.withTransaction((tr) => {
                        tr.update("pictures", picture, {
                            status: asNamed(ComputationStatus.ERROR)
                        });
                    });
                    // Pass to the next image
                    continue;
                }

                // -- Get the diffuser --
                const diffuser = DiffusersRegistry.getModel(prompt.model);
                if (diffuser == null) {
                    // Report error
                    console.error(`Failed to get the diffuser named ${prompt.model} for picture ${picture.id}`);
                    await this._handler.withTransaction((tr) => {
                        tr.update("pictures", picture, {
                            status: asNamed(ComputationStatus.ERROR)
                        });
                        // Manually add the context so clients get notified
                        tr.contexts.push({
                            type: "project",
                            options: {
                                projectId: prompt.projectId
                            }
                        });
                    });
                    // Pass to the next image
                    continue;
                }

                // -- Generate the image --
                try {
                    const img: ImageDescription = {
                        width: prompt.width,
                        height: prompt.height,
                        prompt: prompt.prompt,
                        negative_prompt: prompt.negative_prompt ?? "",
                        seed: picture.seed
                    };
                    const imageData = await diffuser.txt2img(img, false);

                    // For debugging purpose, write image to disk
                    // await writeFile(`${new Date().getTime()}.png`, Buffer.from(imageData, 'base64'));

                    // -- Save --
                    await this._handler.withTransaction((tr) => {
                        const attachment = tr.insert("attachments", {
                            id: asNamed(0),
                            data: asNamed(imageData)
                        });
                        tr.update("pictures", picture, {
                            status: asNamed(ComputationStatus.DONE),
                            attachmentId: attachment.id
                        });
                        // Manually add the context so clients get notified
                        tr.contexts.push({
                            type: "project",
                            options: {
                                projectId: prompt.projectId
                            }
                        });
                    })
                } catch (e) {
                    console.error(`Failed to generate image for picture ${picture.id}`);
                    console.error(e);
                    await this._handler.withTransaction((tr) => {
                        tr.update("pictures", picture, {
                            status: asNamed(ComputationStatus.ERROR)
                        });
                    })
                }
            }
        }

        return lowresPicturesPending.length > 0;
    }

    protected async _scheduleNextIfNeeded(): Promise<void> {
        return this._unqueue().then((hasGenerated: boolean) => {
            if (this._stopOnNextTimeout) {
                return;
            } else {
                setTimeout(this._scheduleNextIfNeeded.bind(this), hasGenerated ? 0 : 2000);
            }
        });
    }

}
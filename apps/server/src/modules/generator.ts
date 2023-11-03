import { SQLHandler } from "@dagda/shared/sql/handler";
import { ComputationStatus, Filters, PromptDTO, Tables } from "@eurekai/shared/src/types";
import { DiffusersRegistry } from "src/diffusers";
import { ImageDescription } from "src/diffusers/diffuser";
//import { NotificationKind } from "@eurekai/shared/src/data";
import { writeFile } from "fs/promises";

interface PromptWithSeed extends PromptDTO {
    seed: number;
}

export class Generator {
    protected _stopOnNextTimeout: boolean = false;

    constructor(protected _handler: SQLHandler<Tables, Filters>) {
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
                            status: ComputationStatus.ERROR
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
                            status: ComputationStatus.ERROR
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
                        negative_prompt: prompt.negative_prompt,
                        seed: picture.seed
                    };
                    console.log(img);
                    const imageData = await diffuser.txt2img(img, false);

                    await writeFile(`${new Date().getTime()}.png`, Buffer.from(imageData, 'base64'));

                    // -- Save --
                    await this._handler.withTransaction((tr) => {
                        const attachment = tr.insert("attachments", {
                            id: 0,
                            data: imageData
                        });
                        tr.update("pictures", picture, {
                            status: ComputationStatus.DONE,
                            attachmentId: attachment.id
                        });
                    })
                } catch (e) {
                    console.error(`Failed to generate image for picture ${picture.id}`);
                    console.error(e);
                    await this._handler.withTransaction((tr) => {
                        tr.update("pictures", picture, {
                            status: ComputationStatus.ERROR
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
import { asNamed } from "@dagda/shared/entities/named.types";
import { AppTypes } from "@eurekai/shared/src/entities";
import { ModelInfo } from "@eurekai/shared/src/models.api";
import Replicate from "replicate";
import { fetch } from "undici";
import { AbstractDiffuser, ImageDescription } from "../diffuser";

export type ModelIdentifier = `${string}/${string}` | `${string}/${string}:${string}`;

/** Diffuser implementation using the Replicate WebService */
export class ReplicateSDXL extends AbstractDiffuser {

    protected _replicate: Replicate;

    public constructor(token: string, protected _model: ModelIdentifier) {
        super();
        this._replicate = new Replicate({
            auth: token
        });
    }

    /** @inheritdoc */
    public override getModelInfo(): ModelInfo {
        return {
            uid: `replicate_${this._model}`,
            displayName: `[Replicate] ${this._model.replace(/\:.*/, "")}`,
            size: 1024
        };
    }

    /** @inheritdoc */
    public override async txt2img(options: ImageDescription): Promise<{ data: AppTypes["BASE64_DATA"] }> {
        // -- Call tge API --
        const output = await this._replicate.run(
            this._model,
            {
                input: {
                    prompt: options.prompt,
                    negative_prompt: options.negative_prompt ?? "",
                    width: +options.width,
                    height: +options.height,
                    seed: +options.seed,

                    guidance_scale: 7,
                    scheduler: "KarrasDPM",
                    disable_safety_checker: true,
                    num_inference_steps: 30
                }
            },
            (prediction) => {
                console.log(`${prediction.created_at} >> ${prediction.completed_at ?? "?"}`);
            }
        );

        // -- Get the image URL --
        if (!Array.isArray(output)) {
            console.error(output);
            throw new Error(`Invalid response`);
        }
        const urls: string[] = output as string[];
        if (urls.length != 1) {
            console.error(output);
            throw new Error(`Expecting only one URL`);
        }
        const url = urls[0];

        // -- Fetch the image --
        // Fetch the URL and convert the received image to base64
        const response = await fetch(url);

        const blob = await response.blob();
        const buffer = await blob.arrayBuffer();
        return { data: asNamed(Buffer.from(buffer).toString("base64")) };
    }
}
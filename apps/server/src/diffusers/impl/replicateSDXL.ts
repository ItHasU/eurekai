import { ModelInfo } from "@eurekai/shared/src/models.api";
import Replicate from "replicate";
import { fetch } from "undici";
import { AbstractDiffuser, ImageDescription } from "../diffuser";

/** Diffuser implementation using the Replicate WebService */
export class ReplicateSDXL extends AbstractDiffuser {

    protected _replicate: Replicate;

    public constructor(token: string) {
        super();
        this._replicate = new Replicate({
            auth: token
        });
    }

    /** @inheritdoc */
    public override getModelInfo(): ModelInfo {
        return {
            uid: "replicate_sdxl",
            displayName: "Replicate SDXL",
            size: 1024
        };
    }

    /** @inheritdoc */
    public override async txt2img(options: ImageDescription, highres: boolean): Promise<string> {
        // -- Call tge API --
        const output = await this._replicate.run(
            "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
            {
                input: {
                    prompt: options.prompt,
                    negative_prompt: options.negative_prompt ?? "",
                    width: options.width,
                    height: options.height,
                    seed: options.seed,

                    guidance_scale: 7,
                    scheduler: "KarrasDPM",
                    disable_safety_checker: true,
                    ...highres ? {
                        num_inference_steps: highres ? 60 : 15,
                        refine: "base_image_refiner",
                        refine_steps: 30
                    } : {
                        num_inference_steps: 15
                    }
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
        return Buffer.from(buffer).toString("base64");
    }
}
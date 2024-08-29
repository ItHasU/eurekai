import { asNamed } from "@dagda/shared/entities/named.types";
import { AppTypes } from "@eurekai/shared/src/entities";
import { ModelInfo } from "@eurekai/shared/src/models.api";
import { OpenAI } from "openai";
import { AbstractDiffuser, ImageDescription } from "../diffuser";

export type ModelIdentifier = `${string}/${string}` | `${string}/${string}:${string}`;

/** Diffuser implementation using the Replicate WebService */
export class DallE extends AbstractDiffuser {

    protected _openai: OpenAI;
    protected _model: "dall-e-2" | "dall-e-3" = "dall-e-3";

    public constructor(token: string) {
        super();
        this._openai = new OpenAI({ apiKey: token });
    }

    /** @inheritdoc */
    public override getLock(options: ImageDescription): string | null {
        // Can generate has many images as necessary in parallel
        return null;
    }

    /** @inheritdoc */
    public override getModelInfo(): ModelInfo {
        return {
            uid: this._model,
            displayName: `[DALL-E] ${this._model}`,
            size: 1024
        };
    }

    /** @inheritdoc */
    public override async txt2img(options: ImageDescription): Promise<{ data: AppTypes["BASE64_DATA"], revisedWidth: AppTypes["PIXELS"], revisedHeight: AppTypes["PIXELS"] }> {
        // -- Call openai API --
        const size = options.width === options.height ? "1024x1024" : (options.width > options.height ? "1792x1024" : "1024x1792");
        const [revisedWidth, revisedHeight] = size.split("x").map(x => +x);

        const output = await this._openai.images.generate({
            prompt: options.prompt,
            n: 1,
            model: this._model,
            response_format: "b64_json",
            size
        });

        if (output.data.length != 1) {
            console.error(output);
            throw new Error(`Expecting only one image`);
        }

        const image = output.data[0].b64_json;
        if (!image) {
            console.error(output);
            throw new Error(`Invalid response, no image data`);
        }

        console.log(output.data[0].revised_prompt);
        return {
            data: asNamed(image),
            revisedWidth: asNamed(revisedWidth),
            revisedHeight: asNamed(revisedHeight)
        };
    }
}
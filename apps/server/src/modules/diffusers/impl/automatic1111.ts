import { Txt2ImgOptions } from "@eurekai/shared/src/types";
import { AbstractAPI, ImageDescription } from "../abstract.api";
import { SDModels } from "@eurekai/shared/src/data";

declare var fetch: typeof import('undici').fetch; // Package undici is only required for typing not for runtime

export type GenerateImageOptions = Omit<Txt2ImgOptions, "prompt" | "negative_prompt" | "width" | "height" | "seed">;

export interface ModelOptions {
    apiURL: string;
    model: string;
    lowresTemplate: GenerateImageOptions;
    highresTemplate: GenerateImageOptions;
}

export class Automatic1111 extends AbstractAPI {

    constructor(protected readonly _options: ModelOptions) {
        super();
    }

    //#region Image generation

    /** @inheritdoc */
    public override async txt2img(image: ImageDescription, highres: boolean): Promise<string> {
        // -- Set model --
        this._setModel(this._options.model);

        // -- Generate image --
        const options: Txt2ImgOptions = {
            ...(highres ? this._options.highresTemplate : this._options.lowresTemplate),
            prompt: image.prompt,
            negative_prompt: image.negative_prompt,
            width: image.width,
            height: image.height,
            seed: image.seed
        };

        // -- Return image --
        const images = await this._txt2img(options);
        if (images == null || images.length === 0) {
            throw "No image generated";
        } else {
            return images[0];
        }
    }

    protected async _setModel(model: string): Promise<void> {
        const url = `${this._options.apiURL}/sdapi/v1/options`;
        const result = await fetch(url, {
            method: 'POST',
            body: JSON.stringify({
                "sd_model_checkpoint": model
            }),
            headers: {
                'Content-Type': 'application/json',
            }
        });
        if (result.status !== 200) {
            throw new Error(result.statusText);
        }
    }

    protected async _txt2img(options: Txt2ImgOptions): Promise<string[]> {
        const url = `${this._options.apiURL}/sdapi/v1/txt2img`;
        const result = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(options),
            headers: {
                'Content-Type': 'application/json',
            }
        });
        if (result.status !== 200) {
            throw new Error(result.statusText);
        } else {
            const data = await result.json() as { images: string[] };
            if (!data.images) {
                throw new Error('api returned an invalid response');
            }
            return data.images;
        }
    }

    //#endregion
}
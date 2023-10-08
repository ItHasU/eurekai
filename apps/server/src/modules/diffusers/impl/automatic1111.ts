import { Txt2ImgOptions } from "@eurekai/shared/src/types";
import { AbstractAPI, ImageDescription } from "../abstract.api";
import { DatabaseWrapper } from "src/modules/db";
import { SDXL } from "./sdxl";
import { SD } from "./sd";

declare var fetch: typeof import('undici').fetch; // Package undici is only required for typing not for runtime

export type GenerateImageOptions = Omit<Txt2ImgOptions, "prompt" | "negative_prompt" | "width" | "height" | "seed">;

/** Stable Diffusion model information */
export interface SDModel {
    title: string,
    model_name: string,
    hash: string,
    sha256: string,
    filename: string,
    config: string
}

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

    //#region Fetch models

    public static async getModels(apiUrl: string): Promise<SDModel[]> {
        const url = `${apiUrl}/sdapi/v1/sd-models`;
        const result = await fetch(url);
        if (result.status !== 200) {
            throw new Error(result.statusText);
        } else {
            return await result.json() as SDModel[];
        }
    }

    //#endregion
}

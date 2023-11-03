import { jsonPost } from "@dagda/server/tools/fetch";
import { Txt2ImgOptions } from "@eurekai/shared/src/types";
import { AbstractDiffuser, ImageDescription } from "../diffuser";

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

export abstract class Automatic1111 extends AbstractDiffuser {

    constructor(protected _title: string, protected readonly _options: ModelOptions) {
        super();
    }

    /** @inheritdoc */
    public override getTitle(): string {
        return this._title;
    }

    //#region Image generation

    /** @inheritdoc */
    public override async txt2img(image: ImageDescription, highres: boolean): Promise<string> {
        // -- Set model --
        await this._setModel(this._options.model);

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
        await jsonPost(url, {
            "sd_model_checkpoint": model
        });
    }

    protected async _txt2img(options: Txt2ImgOptions): Promise<string[]> {
        const url = `${this._options.apiURL}/sdapi/v1/txt2img`;
        const data = await jsonPost<{ images: string[] }>(url, options);
        if (!data.images) {
            throw new Error('api returned an invalid response');
        }
        return data.images;
    }

    //#endregion

}

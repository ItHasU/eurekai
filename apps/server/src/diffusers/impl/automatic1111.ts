import { jsonPost } from "@dagda/server/tools/fetch";
import { asNamed } from "@dagda/shared/entities/named.types";
import { AppTypes } from "@eurekai/shared/src/entities";
import { AbstractDiffuser, ImageDescription } from "../diffuser";
import { getAllModelsWithWOL } from "./automatic1111.tools";

//#region Types ---------------------------------------------------------------

export type SamplingMethod =
    "Euler a" | "Euler" |
    "LMS" | "Heun" |
    "DPM2" | "DPM2 a" | "DPM++ S2 a" | "DPM++ 2M" | "DPM++ SDE" | "DPM fast" | "DPM adaptive" |
    "LMS Karras" |
    "DPM2 Karras" | "DPM2 a Karras" |
    "DPM++ 2S a Karras" | "DPM++ 2M Karras" | "DPM++ SDE Karras" |
    "DDIM" |
    "PLMS";

export interface Txt2ImgOptions {
    prompt: string;
    negative_prompt?: string;
    seed: number;
    sampler_name: SamplingMethod;
    steps: number;
    width: number;
    height: number;

    batch_size: number;
    n_iter: number;

    cfg_scale: number;

    enable_hr?: boolean;
    hr_scale?: number;
    denoising_strength?: number;

    save_images?: boolean;

    refiner_checkpoint?: string,
    refiner_switch_at?: number
}

//#endregion

export type GenerateImageOptions = Omit<Txt2ImgOptions, "prompt" | "negative_prompt" | "width" | "height" | "seed">;

/** Stable Diffusion model information */
export interface SDModel {
    /** This is the string to use for setModel() */
    title: string,
    model_name: string,
    hash: string,
    sha256: string,
    filename: string,
    config: string
}

export interface ModelOptions {
    apiURL: string;
    wolMAC?: string;
    wolIP?: string;
    model: SDModel;
    size: number;
    template: GenerateImageOptions;
}

export abstract class Automatic1111 extends AbstractDiffuser {

    constructor(protected readonly _options: ModelOptions) {
        super();
    }

    //#region Image generation

    /** @inheritdoc */
    public override async txt2img(image: ImageDescription): Promise<{ data: AppTypes["BASE64_DATA"] }> {
        // -- Wait for server to wake up --
        if (this._options.wolMAC != null) {
            try {
                await getAllModelsWithWOL(this._options.apiURL, this._options.wolMAC, this._options.wolIP);
            } catch (e) {
                throw "Failed to wake up server";
            }
        }

        // -- Set model --
        await this._setModel(this._options.model.title);

        // -- Generate image --
        const options: Txt2ImgOptions = {
            ...this._options.template,
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
            return { data: asNamed(images[0]) };
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

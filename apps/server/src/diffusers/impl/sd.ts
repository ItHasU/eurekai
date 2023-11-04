import { ModelInfo } from "@eurekai/shared/src/models.api";
import { Automatic1111, GenerateImageOptions, SDModel } from "./automatic1111";

const DEFAULT_PARAMETERS: GenerateImageOptions = {
    batch_size: 1,
    n_iter: 1,
    sampler_name: "DDIM",
    save_images: false,
    cfg_scale: 7,
    steps: 20
};

/** Stable diffusion model */
export class SD extends Automatic1111 {

    constructor(apiURL: string, model: SDModel) {
        super({
            apiURL,
            model,
            size: 512, // SD 1.5
            lowresTemplate: {
                ...DEFAULT_PARAMETERS
            },
            highresTemplate: {
                ...DEFAULT_PARAMETERS,
                enable_hr: true,
                steps: 30,
                denoising_strength: 0.6,
                hr_scale: 2
            }
        });
    }

    /** @inheritdoc */
    public override getModelInfo(): ModelInfo {
        return {
            uid: `SD-${this._options.model.hash}`,
            displayName: `[SD] ${this._options.model.model_name}`,
            size: this._options.size
        };
    }
}
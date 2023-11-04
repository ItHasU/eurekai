import { ModelInfo } from "@eurekai/shared/src/models.api";
import { Automatic1111, GenerateImageOptions, SDModel } from "./automatic1111";

const DEFAULT_PARAMETERS: GenerateImageOptions = {
    batch_size: 1,
    n_iter: 1,
    sampler_name: "DPM++ 2S a Karras",
    save_images: false,
    cfg_scale: 7,
    steps: 30
};

/** Stable diffusion XL model */
export class SDXL extends Automatic1111 {

    constructor(apiURL: string, model: SDModel, protected _refiner: SDModel) {
        super({
            apiURL,
            model,
            size: 1024,
            lowresTemplate: {
                ...DEFAULT_PARAMETERS,
                steps: 15
            },
            highresTemplate: {
                ...DEFAULT_PARAMETERS,
                refiner_checkpoint: _refiner.title,
                steps: 60,
                refiner_switch_at: 0.5
            }
        });
    }

    /** @inheritdoc */
    public override getModelInfo(): ModelInfo {
        return {
            uid: `SDXL-${this._options.model.hash}-${this._refiner.hash}`,
            displayName: `[SDXL] ${this._options.model.model_name} + ${this._refiner.model_name}`,
            size: this._options.size
        };
    }
}
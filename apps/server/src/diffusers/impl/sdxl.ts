import { ModelInfo } from "@eurekai/shared/src/models.api";
import { Automatic1111, GenerateImageOptions, SDModel } from "./automatic1111";

const DEFAULT_PARAMETERS: GenerateImageOptions = {
    batch_size: 1,
    n_iter: 1,
    sampler_name: "Euler a",
    save_images: false,
    cfg_scale: 7,
    steps: 30
};

/** Stable diffusion XL model */
export class SDXL extends Automatic1111 {

    constructor(apiURL: string, model: SDModel, protected _refiner: SDModel, wolScript?: string) {
        super({
            apiURL,
            model,
            size: 1024,
            wolScript,
            template: {
                ...DEFAULT_PARAMETERS,
                steps: 30
                // Disable the refiner for now
                // refiner_checkpoint: _refiner.title,
                // refiner_switch_at: 0.66
            }
        });
    }

    /** @inheritdoc */
    public override getModelInfo(): ModelInfo {
        return {
            uid: `SDXL-${this._options.model.hash}-${this._refiner.hash}`,
            displayName: `[SDXL] ${this._options.model.model_name}`, // + ${this._refiner.model_name} Refiner is not used anymore
            size: this._options.size
        };
    }
}
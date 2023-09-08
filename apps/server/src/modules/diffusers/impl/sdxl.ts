import { Automatic1111, GenerateImageOptions } from "./automatic1111";

const DEFAULT_PARAMETERS: GenerateImageOptions = {
    batch_size: 1,
    n_iter: 1,
    sampler_name: "DPM++ 2S a Karras",
    save_images: false,
    cfg_scale: 7,
    steps: 20
};

export class SDXL extends Automatic1111 {

    constructor(apiURL: string, model: string, refiner: string) {
        super({
            apiURL,
            model,
            lowresTemplate: {
                ...DEFAULT_PARAMETERS
            },
            highresTemplate: {
                ...DEFAULT_PARAMETERS,
                steps: 50,
                refiner_checkpoint: refiner,
                refiner_switch_at: 0.6
            }
        });
    }

}
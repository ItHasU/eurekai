import { Automatic1111, GenerateImageOptions } from "./automatic1111";

const DEFAULT_PARAMETERS: GenerateImageOptions = {
    batch_size: 1,
    n_iter: 1,
    sampler_name: "DDIM",
    save_images: false,
    cfg_scale: 7,
    steps: 20
};

export class SD extends Automatic1111 {

    constructor(apiURL: string, model: string) {
        super({
            apiURL,
            model,
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

}
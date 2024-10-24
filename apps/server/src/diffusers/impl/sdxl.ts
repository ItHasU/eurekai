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

    constructor(apiURL: string, model: SDModel, wolScript?: string) {
        super("SDXL", {
            apiURL,
            model,
            size: 1024,
            wolScript,
            template: {
                ...DEFAULT_PARAMETERS,
                steps: 30
            }
        });
    }

}
import { ImageDescription } from "../diffuser";
import { ReplicateAbstract } from "./replicate.abstract";

export type ModelIdentifier = `${string}/${string}` | `${string}/${string}:${string}`;

type URI = string;

/** SDXL API */
interface SDXLInput {
    /** {
      "type": "string",
      "title": "Prompt",
      "default": "An astronaut riding a rainbow unicorn",
      "x-order": 0,
      "description": "Input prompt"
    } */
    prompt: string,
    /** {
      "type": "string",
      "title": "Negative Prompt",
      "default": "",
      "x-order": 1,
      "description": "Input Negative Prompt"
    } */
    negative_prompt?: string,
    /** {
      "enum": [
        "DDIM",
        "DPMSolverMultistep",
        "HeunDiscrete",
        "KarrasDPM",
        "K_EULER_ANCESTRAL",
        "K_EULER",
        "PNDM"
      ],
      "type": "string",
      "title": "scheduler",
      "description": "scheduler",
      "default": "K_EULER",
      "x-order": 7
    } */
    scheduler?: "DDIM" | "DPMSolverMultistep" | "HeunDiscrete" | "KarrasDPM" | "K_EULER_ANCESTRAL" | "K_EULER" | "PNDM",
    /** {
      "type": "integer",
      "title": "Seed",
      "x-order": 11,
      "description": "Random seed. Leave blank to randomize the seed"
    } */
    seed: number,
    /** {
      "type": "integer",
      "title": "Width",
      "default": 1024,
      "x-order": 4,
      "description": "Width of output image"
    } */
    width?: number,
    /** {
      "type": "integer",
      "title": "Height",
      "default": 1024,
      "x-order": 5,
      "description": "Height of output image"
    } */
    height?: number,

    /** {
      "type": "integer",
      "title": "Num Outputs",
      "default": 1,
      "maximum": 4,
      "minimum": 1,
      "x-order": 6,
      "description": "Number of images to output."
    } */
    num_outputs?: number,
    /** {
      "type": "boolean",
      "title": "Disable Safety Checker",
      "default": false,
      "x-order": 18,
      "description": "Disable safety checker for generated images. This feature is only available through the API. See [https://replicate.com/docs/how-does-replicate-work#safety](https://replicate.com/docs/how-does-replicate-work#safety)"
    } */
    disable_safety_checker: boolean,

    /** {
      "type": "integer",
      "title": "Num Inference Steps",
      "default": 50,
      "maximum": 500,
      "minimum": 1,
      "x-order": 8,
      "description": "Number of denoising steps"
    } */
    num_inference_steps: number,
    /** {
      "type": "number",
      "title": "Guidance Scale",
      "default": 7.5,
      "maximum": 50,
      "minimum": 1,
      "x-order": 9,
      "description": "Scale for classifier-free guidance"
    } */
    guidance_scale: number,

    //#region Refiner

    /** {
      "enum": [
        "no_refiner",
        "expert_ensemble_refiner",
        "base_image_refiner"
      ],
      "type": "string",
      "title": "refine",
      "description": "Which refine style to use",
      "default": "no_refiner",
      "x-order": 12
    } */
    refine?: "no_refiner" | "expert_ensemble_refiner" | "base_image_refiner",
    /** {
      "type": "number",
      "title": "High Noise Frac",
      "default": 0.8,
      "maximum": 1,
      "minimum": 0,
      "x-order": 13,
      "description": "For expert_ensemble_refiner, the fraction of noise to use"
    } */
    high_noise_frac?: number,
    /** {
      "type": "integer",
      "title": "Refine Steps",
      "x-order": 14,
      "description": "For base_image_refiner, the number of steps to refine, defaults to num_inference_steps"
    } */
    refine_steps?: number,
    /** {
      "type": "boolean",
      "title": "Apply Watermark",
      "default": true,
      "x-order": 15,
      "description": "Applies a watermark to enable determining if an image is generated in downstream applications. If you have other provisions for generating or deploying images safely, you can use this to disable watermarking."
    } */
    apply_watermark: boolean,

    //#endregion

    //#region Lora

    /** {
      "type": "number",
      "title": "Lora Scale",
      "default": 0.6,
      "maximum": 1,
      "minimum": 0,
      "x-order": 16,
      "description": "LoRA additive scale. Only applicable on trained models."
    } */
    lora_scale?: number,

    //#endregion

    //#region Inpainting

    /** {
      "type": "string",
      "title": "Mask",
      "format": "uri",
      "x-order": 3,
      "description": "Input mask for inpaint mode. Black areas will be preserved, white areas will be inpainted."
    } */
    mask?: string,
    /** {
      "type": "string",
      "title": "Image",
      "format": "uri",
      "x-order": 2,
      "description": "Input image for img2img or inpaint mode"
    } */
    image?: string,
    /** {
      "type": "number",
      "title": "Prompt Strength",
      "default": 0.8,
      "maximum": 1,
      "minimum": 0,
      "x-order": 10,
      "description": "Prompt strength when using img2img / inpaint. 1.0 corresponds to full destruction of information in image"
    } */
    prompt_strength?: number,

    //#endregion

}

/** Diffuser implementation using the Replicate WebService */
export class ReplicateSDXL extends ReplicateAbstract<SDXLInput> {

    /** @inheritdoc */
    protected override _getInputFromImageDescription(options: ImageDescription): SDXLInput {
        return {
            prompt: options.prompt,
            negative_prompt: options.negative_prompt ?? "",
            width: +options.width,
            height: +options.height,
            seed: +options.seed,

            num_inference_steps: 30,
            guidance_scale: 7,
            scheduler: "KarrasDPM",

            apply_watermark: false,
            disable_safety_checker: true,
        };
    }

}
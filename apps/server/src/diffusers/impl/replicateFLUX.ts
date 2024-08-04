import { ImageDescription } from "../diffuser";
import { ReplicateAbstract } from "./replicate.abstract";

/** Flux API */
interface FluxInput {
  /** {
    "type": "string",
    "title": "Prompt",
    "x-order": 0,
    "description": "Prompt for generated image"
  } */
  prompt: string;
  /** {
  "type": "integer",
  "title": "Seed",
  "x-order": 3,
  "description": "Random seed. Set for reproducible generation"
} */
  seed: number;
  /** {
    "type": "number",
    "title": "Guidance",
    "default": 3.5,
    "maximum": 10,
    "minimum": 0,
    "x-order": 2,
    "description": "Guidance for generated image. Ignored for flux-schnell"
  } */
  guidance?: string;
  /** {
    "enum": [
      "1:1",
      "16:9",
      "21:9",
      "2:3",
      "3:2",
      "4:5",
      "5:4",
      "9:16",
      "9:21"
    ],
    "type": "string",
    "title": "aspect_ratio",
    "description": "Aspect ratio for the generated image",
    "default": "1:1",
    "x-order": 1
  } */
  aspect_ratio: "1:1" | "16:9" | "21:9" | "2:3" | "3:2" | "4:5" | "5:4" | "9:16" | "9:21";
  /** {
    "enum": [
      "webp",
      "jpg",
      "png"
    ],
    "type": "string",
    "title": "output_format",
    "description": "Format of the output images",
    "default": "webp",
    "x-order": 4
  } */
  output_format: "webp" | "jpg" | "png";
  /** {
    "type": "integer",
    "title": "Output Quality",
    "default": 80,
    "maximum": 100,
    "minimum": 0,
    "x-order": 5,
    "description": "Quality when saving the output images, from 0 to 100. 100 is best quality, 0 is lowest quality. Not relevant for .png outputs"
  } */
  output_quality: number;
  /** {
    "type": "boolean",
    "title": "Disable Safety Checker",
    "default": false,
    "x-order": 6,
    "description": "Disable safety checker for generated images. This feature is only available through the API. See [https://replicate.com/docs/how-does-replicate-work#safety](https://replicate.com/docs/how-does-replicate-work#safety)"
  } */
  disable_safety_checker: boolean;
}

/** Flux API */
export class ReplicateFlux extends ReplicateAbstract<FluxInput> {

  /** @inheritdoc */
  protected override _getInputFromImageDescription(options: ImageDescription): FluxInput {
    const ratio = this._getClosestRatio<FluxInput["aspect_ratio"]>(options, ["1:1", "16:9", "21:9", "2:3", "3:2", "4:5", "5:4", "9:16", "9:21"]);
    return {
      prompt: options.prompt,
      seed: options.seed,
      aspect_ratio: ratio,

      output_format: "png",
      output_quality: 80,
      disable_safety_checker: true
    };
  }

}
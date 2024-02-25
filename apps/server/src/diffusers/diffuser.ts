import { AppTypes } from "@eurekai/shared/src/entities";
import { ModelInfo } from "@eurekai/shared/src/models.api";

/** Common parameters to generate an image */
export interface ImageDescription {
    prompt: string;
    negative_prompt?: string;
    seed: number;
    width: number;
    height: number;
}

/** Abstract API to connect to an image generator */
export abstract class AbstractDiffuser {
    /** Get model info */
    public abstract getModelInfo(): ModelInfo;

    /** Generate an image. */
    public abstract txt2img(options: ImageDescription): Promise<{ data: AppTypes["BASE64_DATA"], revisedWidth?: AppTypes["PIXELS"], revisedHeight?: AppTypes["PIXELS"] }>;
}

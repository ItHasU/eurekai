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
    /**
     * @returns A lock based on the diffuser or on the image description.
     * Two images with the same lock cannot be rendered at the same time.
     * All images with null lock are rendered as soon as they are received.
     */
    public abstract getLock(options: ImageDescription): string | null;

    /** Get model info */
    public abstract getModelInfo(): ModelInfo;

    /** Generate an image. */
    public abstract txt2img(options: ImageDescription): Promise<{ data: AppTypes["BASE64_DATA"], revisedWidth?: AppTypes["PIXELS"], revisedHeight?: AppTypes["PIXELS"] }>;
}

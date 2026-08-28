import { AppTypes } from "@eurekai/shared/src/entities";
import { ModelInfo } from "@eurekai/shared/src/models.api";

/** Common parameters to generate an image */
export interface ImageDescription {
    prompt: string;
    negative_prompt?: string;
    seed: number;
    width: number;
    height: number;
    /**
     * Duration of the generated video, in the unit declared by the model.
     * Null when the model does not expose a duration.
     */
    duration: number | null;
    /** Base64 source image (no "data:...;base64," prefix), null when the prompt has none selected */
    image?: string | null;
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

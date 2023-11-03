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
     * Get title of the model. 
     * Must be unique so it can be reused later.
     */
    public abstract getTitle(): string;

    /** Generate an image. */
    public abstract txt2img(options: ImageDescription, highres: boolean): Promise<string>;
}

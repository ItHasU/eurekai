
export interface ImageDescription {
    prompt: string;
    negative_prompt?: string;
    seed: number;
    width: number;
    height: number;
}

/** Abstract API to connect to an image generator */
export abstract class AbstractAPI {

    /** Generate an image */
    public abstract txt2img(options: ImageDescription, highres: boolean): Promise<string>;

}

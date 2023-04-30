//#region TXT2IMG -------------------------------------------------------------

export type SamplingMethod =
    "Euler a" | "Euler" |
    "LMS" | "Heun" |
    "DPM2" | "DPM2 a" | "DPM++ S2 a" | "DPM++ 2M" | "DPM++ SDE" | "DPM fast" | "DPM adaptive" |
    "LMS Karras" |
    "DPM2 Karras" | "DPM2 a Karras" |
    "DPM++ 2S a Karras" | "DPM++ 2M Karras" | "DPM++ SDE Karras" |
    "DDIM" |
    "PLMS";

export interface Txt2ImgOptions {
    prompt: string;
    negative_prompt?: string;
    seed: number;
    sampler_name: SamplingMethod;
    steps: number;
    width: number;
    height: number;

    batch_size: number;
    n_iter: number;

    cfg_scale: number;

    save_images?: boolean;
}

//#endregion

//#region Database ------------------------------------------------------------

export enum ComputationStatus {
    PENDING = 1,
    COMPUTING,
    DONE,
    ERROR,

    ACCEPTED,
    REJECTED
}

export interface PictureDTO extends PouchDB.Core.IdMeta, PouchDB.Core.RevisionIdMeta {
    /** _id field of a prompt */
    promptId: string;
    /** Options that were used to generate the picture */
    options: Txt2ImgOptions;
    /** Creation timestamp */
    createdAt: number;
    /** Is picture computed */
    computed: ComputationStatus;
    /** Attachments as Base64 */
    _attachments: {
        [filename: string]: {
            "content_type": "image/png",
            "data": string
        }
    }
}

export interface PromptDTO extends PouchDB.Core.IdMeta, PouchDB.Core.RevisionIdMeta {
    /** Virtual index */
    index: number;
    /** Is the prompt active for generation */
    active: boolean;
    /** Positive prompt for the image */
    prompt: string;
    /** Negative prompt for the image */
    negative_prompt?: string;
}

//#endregion
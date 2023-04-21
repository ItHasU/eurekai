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
    /** Options that were used to generate the picture */
    options: Txt2ImgOptions;
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

//#endregion
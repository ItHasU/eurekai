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

    enable_hr?: boolean;
    hr_scale?: number;
    denoising_strength?: number;

    save_images?: boolean;

    refiner_checkpoint?: string,
    refiner_switch_at?: number
}

//#endregion

//#region Database ------------------------------------------------------------

export enum BooleanEnum {
    FALSE = 0,
    TRUE = 1
}

export type Tables = {
    "projects": ProjectDTO;
    "prompts": PromptDTO;
    "seeds": SeedDTO;
    "pictures": PictureDTO;
    "attachments": AttachmentDTO;
};

export type TableName = keyof Tables;
export function t(tableName: TableName): string {
    return tableName;
}

export interface ProjectDTO {
    id: number;
    name: string;
    width: number;
    height: number;
    /** Highres scale */
    scale: number;
    /** Featured image */
    featuredAttachmentId?: number;
    /** Do pictures need to be blurred by default */
    lockable: BooleanEnum;
    /** Pinned */
    pinned: BooleanEnum;
}

export interface ProjectWithStats extends ProjectDTO {
    /** Count of prompts */
    prompts: number;
    /** Count of active prompts */
    activePrompts: number;
    /** Count of pictures waiting for evaluaton */
    doneCount: number;
    /** Count of accepted pictures */
    acceptedCount: number;
    /** Count of rejected pictures */
    rejectedCount: number;
    /** Count of highres pictures */
    highresCount: number;
    /** Count of highres pictures pending */
    highresPendingCount: number;
}

export enum ComputationStatus {
    PENDING = 1,
    COMPUTING,
    DONE,
    ERROR,

    ACCEPTED,
    REJECTED
}

export enum HighresStatus {
    NONE = 0,
    PENDING,
    COMPUTING,
    DONE,
    ERROR,
    DELETED
}

export interface PictureDTO {
    /** id of the picture */
    id: number;
    /** id field of a project */
    projectId: number;
    /** id field of a prompt */
    promptId: number;
    /** seed used to generate the image */
    seed: number;
    /** Options that were used to generate the picture */
    options: Txt2ImgOptions;
    /** Creation timestamp */
    createdAt: number;
    /** Is picture computed */
    computed: ComputationStatus;
    /** Is highres computed */
    highres: HighresStatus;
    /** id field of the attachment (filled once computed) */
    attachmentId?: number;
    /** id field of the highres attachment (filled once computed) */
    highresAttachmentId?: number;
}

export interface PromptDTO {
    /** id of the prompt */
    id: number;
    /** id field of a project */
    projectId: number;
    /** Virtual index to order the prompts */
    orderIndex: number;
    /** Is the prompt active for generation */
    active: boolean;
    /** Positive prompt for the image */
    prompt: string;
    /** Negative prompt for the image */
    negative_prompt?: string;
    /** Maximum count of images to evaluate (0 = no limit) */
    bufferSize: number;
    /** Target count of accepted images for this prompt */
    acceptedTarget: number;
}

export interface SeedDTO {
    /** id of the project */
    projectId: number;
    /** the seed */
    seed: number;
}

export interface AttachmentDTO {
    /** id of the attachement */
    id: number;
    /** data in base64 format */
    data: string;
}

//#endregion
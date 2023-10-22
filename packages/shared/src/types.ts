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

/** Numeric true/false */
export enum BooleanEnum {
    FALSE = 0,
    TRUE = 1
}

/** The list of tables and their related type */
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

/** 
 * A project gather prompts with a common theme
 * Projects are displayed on the front page of the app.
 */
export interface ProjectDTO {
    id: number;
    /** Name input by the user */
    name: string;
    /** Featured image */
    featuredAttachmentId?: number;
    /** 
     * When enabled, if application is not unlocked :
     * - project will be hidden on the front page,
     * - pictures will be blurred.
     */
    lockable: BooleanEnum;
    /** Pinned projects appear first of the front page */
    pinned: BooleanEnum;
}

/** An extended version of the project with properties computed directly from the database */
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

/** State of computation of images */
export enum ComputationStatus {
    /**
     * Not started, not requested yet
     * (Specific for high resolution images) 
     */
    NONE = 0,

    /** Waiting for computation */
    PENDING,
    /** Request sent the the generator */
    COMPUTING,
    /** Response received from the generator */
    DONE,
    /** Error received from the generator */
    ERROR,

    /**
     * Accepted by the user
     * (Only accessible if image was previously DONE)
     */
    ACCEPTED,
    /**
     * Rejected by the user
     * (Only accessible if image was previously DONE)
     */
    REJECTED
}

/** The prompt contains all the necessary information to generate an image (except the seed) */
export interface PromptDTO {
    /** id of the prompt */
    id: number;
    /** id field of a project */
    projectId: number;
    /** Virtual index to order the prompts */
    orderIndex: number;
    /** Is the prompt active for generation */
    active: boolean;

    /** Width */
    width: number;
    /** Height */
    height: number;
    /** Model */
    model: string;

    /** Positive prompt for the image */
    prompt: string;
    /** Negative prompt for the image */
    negative_prompt?: string;
    /** Maximum count of images to evaluate (0 = no limit) */
    bufferSize: number;
}

/** 
 * A picture is an instance of a prompt based on a random seed.
 * It can have two attachments linked
 * - one quick low resolution image,
 * - one slow high resolution image.
 * The second one is supposed to contain more details or have an higher resolution.
 * Due to the nature of image generation, low and high resolution images can be accepted / rejected separately.
 */
export interface PictureDTO {
    /** id of the picture */
    id: number;
    /** id field of a prompt */
    promptId: number;
    
    /** seed used to generate the image */
    seed: number;
    
    /** Is low resolution image computed */
    status: ComputationStatus;
    /** id field of the attachment (filled once computed) */
    attachmentId?: number;

    /** Is high resolution image computed */
    highresStatus: ComputationStatus;
    /** id field of the highres attachment (filled once computed) */
    highresAttachmentId?: number;
}

/** Store preferred seeds */
export interface SeedDTO {
    /** id of the project */
    projectId: number;
    /** the seed */
    seed: number;
}

/** A blob containing the data */
export interface AttachmentDTO {
    /** id of the attachement */
    id: number;
    /** data in base64 format */
    data: string;
}

//#endregion
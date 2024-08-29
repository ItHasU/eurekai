import { JSTypes } from "@dagda/shared/entities/javascript.types";
import { EntitiesModel } from "@dagda/shared/entities/model";

//#region Custom field types --------------------------------------------------

/** State of computation of images */
export enum ComputationStatus {
    /**
     * Not started, not requested yet
     * (Specific for high resolution images) 
     */
    NONE = 0,

    /** Waiting for computation */
    PENDING,
    /** Computing as started */
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

//#endregion

//#region Entities model ------------------------------------------------------

export const APP_MODEL = new EntitiesModel({
    // -- ID types ------------------------------------------------------------
    USER_ID: {
        rawType: JSTypes.number
    },
    PROJECT_ID: {
        rawType: JSTypes.number
    },
    PROMPT_ID: {
        rawType: JSTypes.number
    },
    PICTURE_ID: {
        rawType: JSTypes.number
    },
    ATTACHMENT_ID: {
        rawType: JSTypes.number
    },
    SEED_ID: {
        rawType: JSTypes.number
    },
    // -- Base types ----------------------------------------------------------
    BOOLEAN: {
        rawType: JSTypes.boolean
    },
    INDEX: {
        rawType: JSTypes.number
    },
    TEXT: {
        rawType: JSTypes.string
    },
    // -- Custom types --------------------------------------------------------
    USER_UID: {
        rawType: JSTypes.string
    },
    PIXELS: {
        rawType: JSTypes.number
    },
    SEED: EntitiesModel.type({
        rawType: JSTypes.number
    }),
    MODEL_NAME: EntitiesModel.type({
        rawType: JSTypes.string
    }),
    COMPUTATION_STATUS: EntitiesModel.type<JSTypes.custom, ComputationStatus>({
        rawType: JSTypes.custom
    }),
    BASE64_DATA: {
        rawType: JSTypes.string
    },
    SCORE: EntitiesModel.type<JSTypes.custom, 0 | 1 | 2 | 3 | 4>({
        rawType: JSTypes.custom
    }),
}, {
    users: {
        id: { type: "USER_ID", identity: true },
        uid: { type: "USER_UID" },
        displayName: { type: "TEXT" },
        enabled: { type: "BOOLEAN" }
    },
    projects: {
        id: { type: "PROJECT_ID", identity: true },
        name: { type: "TEXT" },
        featuredAttachmentId: { type: "ATTACHMENT_ID", optional: true },
        lockable: { type: "BOOLEAN" },
        pinned: { type: "BOOLEAN" }
    },
    prompts: {
        id: { type: "PROMPT_ID", identity: true },
        parentId: { type: "PROMPT_ID", optional: true, foreignTable: "prompts" },
        projectId: { type: "PROJECT_ID", foreignTable: "projects" },
        orderIndex: { type: "INDEX" },
        width: { type: "PIXELS" },
        height: { type: "PIXELS" },
        model: { type: "MODEL_NAME" },
        prompt: { type: "TEXT" },
        negative_prompt: { type: "TEXT", optional: true }
    },
    pictures: {
        id: { type: "PICTURE_ID", identity: true },
        promptId: { type: "PROMPT_ID", foreignTable: "prompts" },
        seed: { type: "SEED" },
        status: { type: "COMPUTATION_STATUS" },
        score: { type: "SCORE" },
        attachmentId: { type: "ATTACHMENT_ID", optional: true, foreignTable: "attachments" }
    },
    attachments: {
        id: { type: "ATTACHMENT_ID", identity: true },
        data: { type: "BASE64_DATA" }
    },
    seeds: {
        id: { type: "SEED_ID", identity: true },
        projectId: { type: "PROJECT_ID", foreignTable: "projects" },
        seed: { type: "SEED" }
    }
});

//#endregion

//#region Properties types ----------------------------------------------------

export type AppTypes = typeof APP_MODEL.types;

export type ProjectId = typeof APP_MODEL.types["PROJECT_ID"];
export type PromptId = typeof APP_MODEL.types["PROMPT_ID"];
export type PictureId = typeof APP_MODEL.types["PICTURE_ID"];
export type AttachmentId = typeof APP_MODEL.types["ATTACHMENT_ID"];
export type SeedId = typeof APP_MODEL.types["SEED_ID"];

export type Seed = typeof APP_MODEL.types["SEED"];
export type Score = typeof APP_MODEL.types["SCORE"];

//#endregion

//#region Entities types ------------------------------------------------------

export type AppTables = typeof APP_MODEL.tables;

/** Simple info for the user */
export type UserEntity = typeof APP_MODEL.tables["users"];

/** 
 * A project gather prompts with a common theme
 * Projects are displayed on the front page of the app.
 */
export type ProjectEntity = typeof APP_MODEL.tables["projects"];

/** The prompt contains all the necessary information to generate an image (except the seed) */
export type PromptEntity = typeof APP_MODEL.tables["prompts"];

/** 
 * A picture is an instance of a prompt based on a random seed.
 * It can have two attachments linked
 * - one quick low resolution image,
 * - one slow high resolution image.
 * The second one is supposed to contain more details or have an higher resolution.
 * Due to the nature of image generation, low and high resolution images can be accepted / rejected separately.
 */
export type PictureEntity = typeof APP_MODEL.tables["pictures"];

/** Store preferred seeds */
export type SeedEntity = typeof APP_MODEL.tables["seeds"];

/** A blob containing the data */
export type AttachmentEntity = typeof APP_MODEL.tables["attachments"];

//#endregion

//#region Fetch contexts ------------------------------------------------------

type BaseContext<T extends string, Options> = {
    type: T;
    options: Options;
}

/** Get the list of users */
export type UsersContext = BaseContext<"users", undefined>;
/** Get all projects */
export type ProjectsContext = BaseContext<"projects", undefined>;
/** Get data for a specific project */
export type ProjectContext = BaseContext<"project", { projectId: typeof APP_MODEL.types["PROJECT_ID"] }>;
/** Get pending pictures and associated prompts */
export type PendingPicturesContext = BaseContext<"pending", undefined>;

/** List of all filters */
export type AppContexts = UsersContext | ProjectsContext | ProjectContext | PendingPicturesContext;

/** Compare filters */
export function appContextEquals(newContext: AppContexts, oldContext: AppContexts): boolean {
    if (newContext.type !== oldContext.type) {
        return false;
    } else {
        switch (newContext.type) {
            case "projects":
            case "pending":
                // No options to compare
                return true;
            case "project":
                return newContext.options.projectId === (oldContext as ProjectContext).options.projectId;
            default:
                // Not implemented
                return false;
        }
    }
}

//#endregion

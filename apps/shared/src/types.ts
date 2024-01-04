import { PGTypeHandler } from "@dagda/shared/typings/impl/pg.handler";
import { JSTypes } from "@dagda/shared/typings/javascript.types";

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

//#region Database handler ----------------------------------------------------

export const APP_MODEL = new PGTypeHandler({
    // -- ID types ------------------------------------------------------------
    PROJECT_ID: {
        rawType: JSTypes.number,
        dbType: JSTypes.number,
        dbTypeName: "INTEGER"
    },
    PROMPT_ID: {
        rawType: JSTypes.number,
        dbType: JSTypes.number,
        dbTypeName: "INTEGER"
    },
    PICTURE_ID: {
        rawType: JSTypes.number,
        dbType: JSTypes.number,
        dbTypeName: "INTEGER"
    },
    ATTACHMENT_ID: {
        rawType: JSTypes.number,
        dbType: JSTypes.number,
        dbTypeName: "INTEGER"
    },
    SEED_ID: {
        rawType: JSTypes.number,
        dbType: JSTypes.number,
        dbTypeName: "INTEGER"
    },
    // -- Base types ----------------------------------------------------------
    BOOLEAN: {
        rawType: JSTypes.boolean,
        dbType: JSTypes.boolean,
        dbTypeName: "BOOLEAN"
    },
    INDEX: {
        rawType: JSTypes.number,
        dbType: JSTypes.number,
        dbTypeName: "INTEGER"
    },
    TEXT: {
        rawType: JSTypes.string,
        dbType: JSTypes.string,
        dbTypeName: "TEXT"
    },
    PIXELS: {
        rawType: JSTypes.number,
        dbType: JSTypes.number,
        dbTypeName: "INTEGER"
    },
    // -- Custom types --------------------------------------------------------
    SEED: PGTypeHandler.type({
        rawType: JSTypes.number,
        dbType: JSTypes.string,
        dbTypeName: "BIGINT",
        store: (v: number) => String(v),
        restore: (v: string) => parseInt(v)
    }),
    MODEL_NAME: PGTypeHandler.type({
        rawType: JSTypes.string,
        dbType: JSTypes.string,
        dbTypeName: "TEXT",
        store: (v: string) => v.toLowerCase(),
        restore: (v: string) => v
    }),
    COMPUTATION_STATUS: PGTypeHandler.type<ComputationStatus, JSTypes.custom, JSTypes.number, "SMALLINT">({
        rawType: JSTypes.custom,
        dbType: JSTypes.number,
        dbTypeName: "SMALLINT",
        store: (v: ComputationStatus) => v,
        restore: (v: number) => v as ComputationStatus
    }),
    BASE64_DATA: {
        rawType: JSTypes.string,
        dbType: JSTypes.string,
        dbTypeName: "TEXT"
    }
}, {
    projects: {
        id: { type: "PROJECT_ID", identity: true },
        name: { type: "TEXT" },
        featuredAttachmentId: { type: "ATTACHMENT_ID", optional: true },
        lockable: { type: "BOOLEAN" },
        pinned: { type: "BOOLEAN" }
    },
    prompts: {
        id: { type: "PROMPT_ID", identity: true },
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
        attachmentId: { type: "ATTACHMENT_ID", optional: true, foreignTable: "attachments" },
        highresStatus: { type: "COMPUTATION_STATUS" },
        highresAttachmentId: { type: "ATTACHMENT_ID", optional: true, foreignTable: "attachments" },
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

//#region Types ---------------------------------------------------------------

export type ProjectId = typeof APP_MODEL.types["PROJECT_ID"];
export type Seed = typeof APP_MODEL.types["SEED"];

//#endregion

//#region Database tables -----------------------------------------------------

export type AppTables = typeof APP_MODEL.dtos;

/** 
 * A project gather prompts with a common theme
 * Projects are displayed on the front page of the app.
 */
export type ProjectDTO = typeof APP_MODEL.dtos["projects"];

/** The prompt contains all the necessary information to generate an image (except the seed) */
export type PromptDTO = typeof APP_MODEL.dtos["prompts"];

/** 
 * A picture is an instance of a prompt based on a random seed.
 * It can have two attachments linked
 * - one quick low resolution image,
 * - one slow high resolution image.
 * The second one is supposed to contain more details or have an higher resolution.
 * Due to the nature of image generation, low and high resolution images can be accepted / rejected separately.
 */
export type PictureDTO = typeof APP_MODEL.dtos["pictures"];

/** Store preferred seeds */
export type SeedDTO = typeof APP_MODEL.dtos["seeds"];

/** A blob containing the data */
export type AttachmentDTO = typeof APP_MODEL.dtos["attachments"];

//#endregion

// //#region Database tools ------------------------------------------------------

// export function eq<TableName extends keyof AppTables, P extends keyof AppTables[TableName]>(table: TableName, field: P, value: AppTables[TableName][P], quoted: number extends AppTables[TableName][P] ? false : true) {
//     return `"${table}"."${field as string}" = ${quoted ? "'" : ""}${new String(value ?? null).toString()}${quoted ? "'" : ""}`;
// }
// export function set<TableName extends keyof AppTables, P extends keyof AppTables[TableName]>(table: TableName, field: P, value: AppTables[TableName][P], quoted: number extends AppTables[TableName][P] ? false : true) {
//     return `"${field as string}" = ${quoted ? "'" : ""}${new String(value ?? null).toString()}${quoted ? "'" : ""}`;
// }

// //#endregion

//#region Fetch filters -------------------------------------------------------

type BaseContext<T extends string, Options> = {
    type: T;
    options: Options;
}

/** Get all projects */
export type ProjectsContext = BaseContext<"projects", undefined>;
/** Get data for a specific project */
export type ProjectContext = BaseContext<"project", { projectId: typeof APP_MODEL.types["PROJECT_ID"] }>;
/** Get pending pictures and associated prompts */
export type PendingPicturesContext = BaseContext<"pending", undefined>;

/** List of all filters */
export type AppContexts = ProjectsContext | ProjectContext | PendingPicturesContext;

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

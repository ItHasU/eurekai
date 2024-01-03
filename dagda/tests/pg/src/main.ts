import { PGTypeHandler } from "@dagda/shared/typings/impl/pg.handler";
import { JSTypes } from "@dagda/shared/typings/javascript.types";
import { asNamed } from "@dagda/shared/typings/named.types";

export enum ComputationStatus {
    NOT_STARTED = 0,
    IN_PROGRESS = 1,
    DONE = 2,
    ERROR = 3
}

const APP_TYPES = new PGTypeHandler({
    "PROJECT_ID": {
        rawType: JSTypes.number,
        dbType: JSTypes.number,
        dbTypeName: "INTEGER"
    },
    "PROMPT_ID": {
        rawType: JSTypes.number,
        dbType: JSTypes.number,
        dbTypeName: "INTEGER"
    },
    "IMAGE_ID": {
        rawType: JSTypes.number,
        dbType: JSTypes.number,
        dbTypeName: "INTEGER"
    },
    "TEXT": {
        rawType: JSTypes.string,
        dbType: JSTypes.string,
        dbTypeName: "TEXT"
    },
    "BOOLEAN": {
        rawType: JSTypes.boolean,
        dbType: JSTypes.boolean,
        dbTypeName: "BOOLEAN"
    },
    "SEED": PGTypeHandler.type({
        rawType: JSTypes.number,
        dbType: JSTypes.string,
        dbTypeName: "BIGINT",
        store: (v: number) => String(v),
        restore: (v: string) => parseInt(v)
    }),
    "COMPUTATION_STATUS": PGTypeHandler.type<ComputationStatus, JSTypes.custom, JSTypes.number, "SMALLINT">({
        rawType: JSTypes.custom,
        dbType: JSTypes.number,
        dbTypeName: "SMALLINT",
        store: (v: ComputationStatus) => v,
        restore: (v: number) => v as ComputationStatus
    })
}, {
    projects: {
        id: { type: "PROJECT_ID", identity: true },
        name: { type: "TEXT" }
    },
    prompts: {
        id: { type: "PROMPT_ID", identity: true },
        projectId: { type: "PROJECT_ID", foreignTable: "projects" },
        prompt: { type: "TEXT" },
        negativePrompt: { type: "TEXT", optional: true }
    },
    images: {
        id: { type: "IMAGE_ID", identity: true },
        promptId: { type: "PROMPT_ID", foreignTable: "prompts" },
        seed: { type: "SEED" },
        status: { type: "COMPUTATION_STATUS" },
    }
});

type AppTypes = typeof APP_TYPES.types;
type AppTableNames = typeof APP_TYPES.tablenames;
type AppDTOs = typeof APP_TYPES.dtos;

type ProjectDTO = AppDTOs["projects"];
type PromptDTO = AppDTOs["prompts"];
type ImageDTO = AppDTOs["images"];

const project: ProjectDTO = {
    id: asNamed(1),
    name: asNamed("test")
};
const prompt: PromptDTO = {
    id: asNamed(1),
    projectId: project.id,
    prompt: asNamed("test"),
    negativePrompt: asNamed("test")
};
const image: ImageDTO = {
    id: asNamed(1),
    promptId: prompt.id,
    seed: asNamed(46012),
    status: asNamed(ComputationStatus.DONE)
};

const tables = APP_TYPES.getTables();
console.log(tables);
for (const table of APP_TYPES.getTables()) {
    console.log("----------------------------------------");
    console.log(APP_TYPES.generateCreateTableSQL(table));
}

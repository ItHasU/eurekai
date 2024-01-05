import { JSTypes } from "@dagda/shared/entities/javascript.types";
import { EntitiesModel } from "@dagda/shared/entities/model";
import { asNamed } from "@dagda/shared/entities/named.types";

const APP_TYPES = new EntitiesModel({
    "PROJECT_ID": {
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
    }
}, {
    projects: {
        id: { type: "PROJECT_ID", identity: true },
        name: { type: "TEXT" }
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

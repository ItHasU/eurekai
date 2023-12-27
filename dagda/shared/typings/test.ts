import { JSStaticType, JSTypes } from "./javascript.types";

export class TypeHandler<
    DBFieldTypes extends string,
    Types extends Record<string, TypeDefinition<JSTypes, JSTypes, DBFieldTypes>>,
    Tables extends Record<string, Record<string, keyof Types>>
> {

    constructor(types: Types, tables: Tables) {
    }

    public get types(): { [K in keyof Types]: NamedType<K, Types[K]> } {
        return undefined as any;
    }

    /** Get the list of tables */
    public get tablenames(): keyof Tables {
        return undefined as any;
    }

    public get dtos(): { [Table in keyof Tables]: { [K in keyof Tables[Table]]: NamedType<Tables[Table][K], Types[Tables[Table][K]]> } } {
        return undefined as any;
    }

}

type TypeDefinition<JSType extends JSTypes, DBType extends JSTypes, DBTypeNames extends string> = {
    /** The type of the value when stored in JS */
    rawType: JSType,
    /** The type of the value when stored in the DB */
    dbType: DBType,
    /** The type name for the DB */
    dbTypeName: DBTypeNames,
    /** Convert from RAW to DB */
    store?: (v: JSStaticType<JSType>) => JSStaticType<DBType>,
    /** Convert from DB to RAW */
    restore?: (v: JSStaticType<DBType>) => JSStaticType<JSType>
}

type PGTypes = "SERIAL" | "TEXT" | "BOOLEAN" | "INTEGER";

type Named<Name, Value> = Value & { _name: Name };
type NamedType<Name, T> = T extends TypeDefinition<infer JSType, infer DBType, string> ? Named<Name, JSStaticType<JSType>> : never;

const APP_TYPES = new TypeHandler({
    "PROJECT_ID": {
        rawType: JSTypes.number,
        dbType: JSTypes.string, // As it is stored as a BigInt, we will retrieve it as a string
        dbTypeName: "SERIAL"
    },
    "PROMPT_ID": {
        rawType: JSTypes.number,
        dbType: JSTypes.string, // As it is stored as a BigInt, we will retrieve it as a string
        dbTypeName: "SERIAL"
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
    "INTEGER": {
        rawType: JSTypes.number,
        dbType: JSTypes.number,
        dbTypeName: "INTEGER"
    }
}, {
    projects: {
        id: "PROJECT_ID",
        name: "TEXT"
    },
    prompts: {
        id: "PROMPT_ID",
        projectId: "PROJECT_ID",
        prompt: "TEXT",
        negativePrompt: "TEXT"
    }
});

function asNamed<Name extends string, V>(v: V): Named<Name, V> {
    return v as Named<Name, V>;
}

interface Tables {
    "projects": ProjectDTO
}

type AppTypes = typeof APP_TYPES.types;
type AppTableNames = typeof APP_TYPES.tablenames;
type AppDTOs = typeof APP_TYPES.dtos;

type ProjectDTO = AppDTOs["projects"];
type PromptDTO = AppDTOs["prompts"];

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

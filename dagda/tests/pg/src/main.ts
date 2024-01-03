import { JSStaticType, JSTypes } from "@dagda/shared/typings/javascript.types";

export class TypeHandler<
    DBFieldTypes extends string,
    Types extends Record<string, TypeDefinition<JSTypes, JSTypes, DBFieldTypes>>,
    Tables extends Record<string, Record<string, { type: keyof Types, identity?: true, optional?: true }>>
> {

    constructor(protected readonly _types: Types, protected readonly _tables: Tables) {
    }

    public static type<JSType extends JSTypes, DBType extends JSTypes, DBTypeName extends string>(definition: TypeDefinition<JSType, DBType, DBTypeName>): TypeDefinition<JSType, DBType, DBTypeName> {
        return definition;
    }

    public get types(): { [K in keyof Types]: NamedType<K, Types[K]> } {
        return undefined as any;
    }

    /** Use this property with typeof to get the list */
    public get tablenames(): keyof Tables {
        return undefined as any;
    }

    /** Use this property to get the list of types associated to table names */
    public get dtos(): { [Table in keyof Tables]: { [K in keyof Tables[Table]]: NamedType<Tables[Table][K]["type"], Types[Tables[Table][K]["type"]]> } } {
        return undefined as any;
    }

    /** Get the list of tables */
    public getTables(): (keyof Tables)[] {
        return Object.keys(this._tables);
    }

    /** Get the list of fields for a table */
    public getTableFields<T extends keyof Tables>(table: T): (keyof Tables[T])[] {
        return Object.keys(this._tables[table]);
    }

    public getFieldType<T extends keyof Tables, F extends keyof Tables[T]>(table: T, field: F): Types[Tables[T][F]["type"]] {
        return this._types[this._tables[table][field]["type"]];
    }

    public isFieldIdentity<T extends keyof Tables, F extends keyof Tables[T]>(table: T, field: F): boolean {
        return this._tables[table][field]["identity"] === true;
    }

    public isFieldOptional<T extends keyof Tables, F extends keyof Tables[T]>(table: T, field: F): boolean {
        return this._tables[table][field]["optional"] === true;
    }
}

export class PGTypeHandler<
    Types extends Record<string, TypeDefinition<JSTypes, JSTypes, PGTypes>>,
    Tables extends Record<string, Record<string, { type: keyof Types, identity?: true, optional?: true }>>
> extends TypeHandler<PGTypes, Types, Tables> {
    public generateCreateTableSQL<T extends keyof Tables>(table: T): string {
        const fields = this.getTableFields(table);
        const fieldDefs = fields.map(field => {
            const type = this.getFieldType(table, field);
            let fieldCreation = `${field as string} ${type.dbTypeName}`;
            if (this.isFieldIdentity(table, field)) {
                fieldCreation += " PRIMARY KEY GENERATED ALWAYS AS IDENTITY";
            }
            if (this.isFieldOptional(table, field)) {
                fieldCreation += " NULL";
            } else {
                fieldCreation += " NOT NULL";
            }
            return fieldCreation;
        });
        return `CREATE TABLE IF NOT EXISTS ${table as string} (\n${fieldDefs.join(",\n")}\n);`;
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

type PGTypes = "SERIAL" | "TEXT" | "BOOLEAN" | "INTEGER" | "BIGINT";

type Named<Name, Value> = Value & { _name: Name };
type NamedType<Name, T> = T extends TypeDefinition<infer JSType, any, string> ? Named<Name, JSStaticType<JSType>> : never;

const APP_TYPES = new PGTypeHandler({
    "PROJECT_ID": {
        rawType: JSTypes.number,
        dbType: JSTypes.string, // As it is stored as a BigInt, we will retrieve it as a string
        dbTypeName: "INTEGER"
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
    },
    "SEED": PGTypeHandler.type({
        rawType: JSTypes.number,
        dbType: JSTypes.string,
        dbTypeName: "BIGINT",
        store: (v: number) => String(v),
        restore: (v: string) => parseInt(v)
    })
}, {
    projects: {
        id: { type: "PROJECT_ID", identity: true },
        name: { type: "TEXT" }
    },
    prompts: {
        id: { type: "PROMPT_ID", identity: true },
        projectId: { type: "PROJECT_ID" },
        prompt: { type: "TEXT" },
        negativePrompt: { type: "TEXT", optional: true }
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

const tables = APP_TYPES.getTables();
console.log(tables);
for (const table of APP_TYPES.getTables()) {
    console.log("----------------------------------------");
    console.log(APP_TYPES.generateCreateTableSQL(table));
    // const fields = APP_TYPES.getTableFields(table);
    // for (const field of fields) {
    //     const type = APP_TYPES.getFieldType(table, field);
    //     console.log(`${table}.${field}: ${type.dbTypeName}`);
    // }
}

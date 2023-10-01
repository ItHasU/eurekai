import { Named, NamedTyping, Static, asNamed } from "./typings";
import { JSONTypeOf, TypingsManager } from "./typings.manager";

// -- Check types creation --
const SQLBoolean = new NamedTyping<"boolean", boolean, number>({
    dbToJSON: (v: number) => v === 0 ? false : true,
    jsonToDB: (v: boolean) => v ? 1 : 0
});
type SQLBoolean = Static<typeof SQLBoolean>;

const b1: SQLBoolean = asNamed<SQLBoolean>(true);

const b2: boolean = b1;

// -- Check that we can handle a collection of types --

const SQLText = new NamedTyping<"text", string, string>({ dbToJSON: undefined, jsonToDB: undefined });
type SQLText = Static<typeof SQLBoolean>;

const APP_TYPES = new TypingsManager<"boolean" | "text", { boolean: boolean, text: string }, { boolean: number, text: string }>({
    "boolean": SQLBoolean,
    "text": SQLText
});

type FieldTypes = ReturnType<(typeof APP_TYPES)["asType"]>;

const v = APP_TYPES.assertJSONType("boolean", true);
const v2 = APP_TYPES.getNamedType("boolean", false);
const v3: boolean = v2;
const v4: Named<"boolean", boolean> = v2;

function registerTable<TableName extends string, Definition extends Record<string, FieldTypes>>(tableName: string, fields: Definition): { DTO?: { [K in keyof Definition]: void } } {
    return {};
}

const userDef = registerTable("user", {
    name: "text",
    isActive: "boolean"
});
type UserDTO = (typeof userDef)["DTO"];
import { JSStaticType, JSTypes } from "./javascript.types";

export type CustomType<Name extends string, JSType extends JSTypes, DBType extends String> = {
    name: Name,
    jsType: JSTypes,
    dbType: DBType
};

export type StaticType<T extends CustomType<Name, JSType, DBType>, Name extends string, JSType extends JSTypes, DBType extends string> = JSStaticType<T["jsType"]> & { _type: JSTypes, _db: DBType };

export const ID: CustomType<"ID", JSTypes.number, "SERIAL"> = {
    name: "ID",
    jsType: JSTypes.number,
    dbType: "SERIAL"
};
export type T_ID = StaticType<typeof ID, "ID", JSTypes.number, "SERIAL">;
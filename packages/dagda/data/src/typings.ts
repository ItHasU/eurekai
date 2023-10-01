
//#region Temporary

import { Text } from "./impl/jsTypes";

/** Can be used either as a Named type or as V. If you use it as V, Named typing will be lost. */
export type Named<T extends string, V> = V & { __type: T, __value: V };
/** Can only be used as its Named type */
export type StrictNamed<T extends string, V> = { __type: T, __value: V };
/** Get the value type (V) of a [Strict]Named type */
export type ValueOfNamed<NT> = NT extends { __value: infer V } ? V : never;
/** Get the type name (T extends string) of a [Strict]Named type */
export type TypeOfNamed<NT> = NT extends { __type: infer T extends string } ? T : never;

export class NamedTyping<Name extends string, JSType, DBType = JSType> {
    private _name!: Name;

    constructor(public readonly options: {
        dbToJSON: DBType extends JSType ? undefined /* Can directly be converted */ : (v: DBType) => JSType,
        jsonToDB: JSType extends DBType ? undefined /* Can directly be converted */ : (v: JSType) => DBType
    }) { }
}

export type Static<T> = T extends NamedTyping<infer Name, infer JSType, infer DBType> ? Named<Name, JSType> : never;


/** Cast a value to a [Strict]Named type */
export function asNamed<NT>(value: ValueOfNamed<NT>): NT {
    return value as NT;
}

//#endregion

export interface PropertyConfig<Name extends string, JSType> {
    type: NamedTyping<Name, JSType>;
    computed: boolean;
}

export class DataRecord<T extends Record<string, PropertyConfig<string, unknown>>> {
    constructor(public readonly definition: T) { }
}

export type DataInDB<R> = R extends DataRecord<infer T> ? {
    [K in keyof T]: Static<T[K]["type"]>
} : never;

// export const User = new DataRecord({
//     name: {
//         type: new Text(),
//         computed: false
//     }
// });

// export type UserRecordInDb = DataInDB<typeof User>;

// const u1: UserRecordInDb = {
//     name: "test"
// };
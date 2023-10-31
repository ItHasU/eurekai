import { NamedTyping } from "./typings";

export type Reference<TableName extends string> = NamedTyping<TableName, number, number>;

export abstract class TableProxy<TableName extends string, DB extends Object, Extended extends DB = DB> {

    constructor(tableName: TableName) { }

    public abstract getPropertyValue<K extends keyof Extended>(reference: Reference<TableName>, propertyName: K): Promise<Extended[K]>;

    public abstract getObject(reference: Reference<TableName>): Promise<Extended>;

    public abstract setPropertyValue<K extends keyof Extended>(item: Reference<TableName>, propertyName: K, value: Extended[K]): Promise<void>;

    public abstract setPropertiesValues(item: Reference<TableName>, values: Partial<Extended>): Promise<void>;

}
import { JSStaticType, JSTypes, Nullable } from "./javascript.types";
import { Named } from "./named.types";

export type NamedType<Name, T> = T extends TypeDefinition<infer E, infer JSType, any, string> ? Named<Name, JSStaticType<JSType, E>> : never;

/** 
 * Type definition
 * @param Custom Can be used for a custom JS type
 * @param JSType The type of the value when stored in JS
 * @param DBType The type of the value when stored in the DB (cannot be custom)
 * @param DBTypeNames The type name for the DB
 */
export type TypeDefinition<Custom, JSType extends JSTypes, DBType extends JSTypes, DBTypeNames extends string> = {
    /** The type of the value when stored in JS */
    rawType: JSType,
    /** The type of the value when stored in the DB */
    dbType: DBType,
    /** The type name for the DB */
    dbTypeName: DBTypeNames,
    /** Convert from RAW to DB */
    store?: (v: JSStaticType<JSType, Custom>) => JSStaticType<DBType>,
    /** Convert from DB to RAW */
    restore?: (v: JSStaticType<DBType>) => JSStaticType<JSType, Custom>
}

export type FieldDefinition<Types, Tables> = {
    type: keyof Types,
    identity?: true,
    optional?: true,
    foreignTable?: keyof Tables
}


/** This class handles all information for the types used in the application */
export class TypeHandler<
    DBFieldTypes extends string,
    Types extends Record<string, TypeDefinition<any, JSTypes, JSTypes, DBFieldTypes>>,
    Tables extends Record<string, Record<string, FieldDefinition<Types, Tables>>>
> {

    constructor(protected readonly _types: Types, protected readonly _tables: Tables) {
        this._validate();
    }

    //#region Utility methods

    public static type<Custom, JSType extends JSTypes, DBType extends JSTypes, DBTypeName extends string>(definition: TypeDefinition<Custom, JSType, DBType, DBTypeName>): TypeDefinition<Custom, JSType, DBType, DBTypeName> {
        return definition;
    }

    //#endregion

    //#region Typing methods, to be used with typeof

    public get types(): { [K in keyof Types]: NamedType<K, Types[K]> } {
        return undefined as any;
    }

    /** Use this property with typeof to get the list */
    public get tablenames(): keyof Tables {
        return undefined as any;
    }

    /** Use this property to get the list of types associated to table names */
    public get dtos(): { [Table in keyof Tables]: { [K in keyof Tables[Table]]: Tables[Table][K] extends { optional: true } ? Nullable<NamedType<Tables[Table][K]["type"], Types[Tables[Table][K]["type"]]>> : NamedType<Tables[Table][K]["type"], Types[Tables[Table][K]["type"]]> } } {
        return undefined as any;
    }

    //#endregion

    //#region Get information about the types

    public getTypes(): (keyof Types)[] {
        return Object.keys(this._types);
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

    public isFieldForeign<T extends keyof Tables, F extends keyof Tables[T]>(table: T, field: F): boolean {
        return this._tables[table][field]["foreignTable"] != null;
    }

    public getFieldForeignTable<T extends keyof Tables, F extends keyof Tables[T]>(table: T, field: F): keyof Tables | null {
        return this._tables[table][field]["foreignTable"] ?? null;
    }

    public getTableForeignKeys<T extends keyof Tables>(table: T): { [K in keyof Tables[T]]: (keyof Tables) | null } {
        const foreignKeys: { [K in keyof Tables[T]]: (keyof Tables) | null } = {} as any;
        for (const field of this.getTableFields(table)) {
            foreignKeys[field] = this.getFieldForeignTable(table, field);
        }
        return foreignKeys;
    }

    public getForeignKeys(): { [T in keyof Tables]: { [K in keyof Tables[T]]: boolean } } {
        const foreignKeys: { [T in keyof Tables]: { [K in keyof Tables[T]]: boolean } } = {} as any;
        for (const table of this.getTables()) {
            foreignKeys[table] = {} as any;
            for (const field of this.getTableFields(table)) {
                foreignKeys[table][field] = this.isFieldForeign(table, field);
            }
        }
        return foreignKeys;
    }

    //#endregion

    //#region Validation methods

    /** 
     * Validate the model 
     * @throws if the model is invalid
     */
    protected _validate(): void {
        for (const type of this.getTypes()) {
            this._validateType(type);
        }
        for (const table of this.getTables()) {
            this._validateTable(table);
        }
    }

    protected _validateType(type: keyof Types): void {
        const typeDef = this._types[type];

        // Check that the DB type is not custom
        if (typeDef.dbType === JSTypes.custom) {
            throw new Error(`Type ${type as string} has a custom DB type`);
        }
        // Check that if the value of storage is different from the raw type, there are both store and restore functions
        if (typeDef.dbType !== typeDef.rawType && (!typeDef.store || !typeDef.restore)) {
            throw new Error(`Type ${type as string} has a different raw and DB type, but no store or restore function`);
        }
    }

    protected _validateTable(table: keyof Tables): void {
        // Check that there is only one identity field
        let idFieldCount: number = 0;
        for (const field of this.getTableFields(table)) {
            if (this.isFieldIdentity(table, field)) {
                idFieldCount++;
            }
        }
        if (idFieldCount === 0) {
            throw new Error(`Table ${table as string} does not have an identity field`);
        } else if (idFieldCount > 1) {
            throw new Error(`Table ${table as string} has more than one identity field`);
        }
    }

    //#endregion
}
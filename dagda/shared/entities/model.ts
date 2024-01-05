import { JSStaticType, JSTypes, Nullable } from "./javascript.types";
import { Named } from "./named.types";

export type NamedType<Name, T> = T extends TypeDefinition<infer RawType, infer Custom> ? Named<Name, JSStaticType<RawType, Custom>> : never;

/** 
 * Type definition that can be used for the properties of the entities.
 * @param Custom Can be used for a custom JS type
 * @param RawType The type of the value when stored in JS
 */
export type TypeDefinition<RawType extends JSTypes, Custom> = {
    /** The type of the value when stored in JS */
    rawType: RawType;
}

/**
 * Field definition that can be used for the properties of the entities.
 * @param Types The map of types used in the application
 * @param Tables The map of tables used in the application
 */
export type FieldDefinition<Types, Tables> = {
    type: keyof Types;
    identity?: boolean;
    optional?: true;
    foreignTable?: keyof Tables;
}

export type IdFieldDefinition<Types, Tables> = {
    type: keyof Types;
    identity: true
};

export type TypeDefinitions = Record<string, TypeDefinition<JSTypes, any>>;
export type TableDefinitions<Types, Tables> = Record<keyof Tables, {
    id: IdFieldDefinition<Types, Tables>;
    [key: string]: FieldDefinition<Types, Tables>;
}>

/** 
 * This class handles all information for the data used in the application.
 * You should not fill Types and Tables directly, they are computed by TypeScript from the parameters passed to the constructor.
 * 
 * @param Types are for the types of the properties of the entities.
 * @param Tables are for the entities themselves.
 */
export class EntitiesModel<
    Types extends TypeDefinitions,
    Tables extends TableDefinitions<Types, Tables>
> {

    /**
     * Create a new entity model.
     * @param _types The map of types used in the application
     * @param _tables The map of tables used in the application
     */
    constructor(protected readonly _types: Types, protected readonly _tables: Tables) {
        this._validate();
    }

    //#region Utility methods

    /** Utility method to the create type definition with custom types easily */
    public static type<RawType extends JSTypes, Custom>(definition: TypeDefinition<RawType, Custom>): TypeDefinition<RawType, Custom> {
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
    public get tables(): { [Table in keyof Tables]: { [K in keyof Tables[Table]]: Tables[Table][K] extends { optional: true } ? Nullable<NamedType<Tables[Table][K]["type"], Types[Tables[Table][K]["type"]]>> : NamedType<Tables[Table][K]["type"], Types[Tables[Table][K]["type"]]> } } {
        return undefined as any;
    }

    //#endregion

    //#region Get information about the types

    public getTypeNames(): (keyof Types)[] {
        return Object.keys(this._types);
    }

    /** Get the list of tables */
    public getTableNames(): (keyof Tables)[] {
        return Object.keys(this._tables) as (keyof Tables)[];
    }

    /** Get the list of fields for a table */
    public getTableFieldNames<T extends keyof Tables>(tableName: T): (keyof Tables[T])[] {
        return Object.keys(this._tables[tableName]);
    }

    public getFieldType<T extends keyof Tables, F extends keyof Tables[T]>(tableName: T, fieldName: F): Types[Tables[T][F]["type"]] {
        return this._types[this._tables[tableName][fieldName]["type"]];
    }

    public isFieldIdentity<T extends keyof Tables, F extends keyof Tables[T]>(tableName: T, fieldName: F): boolean {
        return this._tables[tableName][fieldName]["identity"] === true;
    }

    public isFieldOptional<T extends keyof Tables, F extends keyof Tables[T]>(tableName: T, fieldName: F): boolean {
        return this._tables[tableName][fieldName]["optional"] === true;
    }

    public isFieldForeign<T extends keyof Tables, F extends keyof Tables[T]>(tableName: T, fieldName: F): boolean {
        return this._tables[tableName][fieldName]["foreignTable"] != null;
    }

    public getFieldForeignTableName<T extends keyof Tables, F extends keyof Tables[T]>(tableName: T, fieldName: F): (keyof Tables) | null {
        return this._tables[tableName][fieldName]["foreignTable"] ?? null;
    }

    public getTableForeignKeys<T extends keyof Tables>(table: T): { [K in keyof Tables[T]]: (keyof Tables) | null } {
        const foreignKeys: { [K in keyof Tables[T]]: (keyof Tables) | null } = {} as any;
        for (const field of this.getTableFieldNames(table)) {
            foreignKeys[field] = this.getFieldForeignTableName(table, field);
        }
        return foreignKeys;
    }

    public getForeignKeys(): { [T in keyof Tables]: { [K in keyof Tables[T]]: boolean } } {
        const foreignKeys: { [T in keyof Tables]: { [K in keyof Tables[T]]: boolean } } = {} as any;
        for (const table of this.getTableNames()) {
            foreignKeys[table] = {} as any;
            for (const field of this.getTableFieldNames(table)) {
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
        for (const type of this.getTypeNames()) {
            this._validateType(type);
        }
        for (const table of this.getTableNames()) {
            this._validateTable(table);
        }
    }

    protected _validateType(type: keyof Types): void {
    }

    protected _validateTable(table: keyof Tables): void {
        // Check that there is only one identity field
        let idFieldCount: number = 0;
        for (const field of this.getTableFieldNames(table)) {
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
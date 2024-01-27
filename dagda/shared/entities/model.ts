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
    fromVersion?: number;
    toVersion?: number;
}

export type IdFieldDefinition<Types, Tables> = {
    type: keyof Types;
    identity: true;
    fromVersion?: never; // Force from the first version
    toVersion?: never;   // Force until the last version
};

export type TypeDefinitions = Record<string, TypeDefinition<JSTypes, any>>;
export type FieldDefinitions<Types, Tables> = Record<keyof Tables, {
    id: IdFieldDefinition<Types, Tables>;
    [key: string]: FieldDefinition<Types, Tables>;
}>

export type KeysWithToVersion<T> = { [K in keyof T]: T[K] extends { toVersion: any } ? never : K }[keyof T];

/** 
 * This class handles all information for the data used in the application.
 * You should not fill Types and Tables directly, they are computed by TypeScript from the parameters passed to the constructor.
 * 
 * @param Types are for the types of the properties of the entities.
 * @param Tables are for the entities themselves.
 */
export class EntitiesModel<
    Types extends TypeDefinitions,
    Tables extends FieldDefinitions<Types, Tables>,
    Version extends number = 1
> {

    /**
     * Create a new entity model.
     * @param _types The map of types used in the application
     * @param _tables The map of tables used in the application
     */
    constructor(protected readonly _types: Types, protected readonly _tables: Tables) {
    }

    //#region Utility methods

    /** Utility method to the create type definition with custom types easily */
    public static type<RawType extends JSTypes, Custom>(definition: TypeDefinition<RawType, Custom>): TypeDefinition<RawType, Custom> {
        return definition;
    }

    //#endregion

    //#region Typing methods, to be used with typeof

    public get typeNames(): keyof Types {
        return undefined as any;
    }

    public get types(): { [K in keyof Types]: NamedType<K, Types[K]> } {
        return undefined as any;
    }

    /** Use this property with typeof to get the list */
    public get tableNames(): keyof Tables {
        return undefined as any;
    }

    /** Get the current version of the model */
    public get version(): number {
        let version: number = 0;
        for (const table of this.getTableNames()) {
            for (const field of this.getTableFieldNames(table)) {
                const fromFieldVersion = this._tables[table][field].fromVersion;
                if (fromFieldVersion != null && version < fromFieldVersion) {
                    version = fromFieldVersion;
                }
                const toFieldVersion = this._tables[table][field].toVersion;
                if (toFieldVersion != null && version < toFieldVersion) {
                    version = toFieldVersion;
                }
            }
        }
        return version;
    }

    /** Use this property to get the list of types associated to table names */
    public get tables(): { [Table in keyof Tables]: {
        [K in KeysWithToVersion<Tables[Table]>]:
        undefined extends Tables[Table][K]["toVersion"] ?
        (Tables[Table][K] extends { optional: true } ? Nullable<NamedType<Tables[Table][K]["type"], Types[Tables[Table][K]["type"]]>> :
            NamedType<Tables[Table][K]["type"], Types[Tables[Table][K]["type"]]>) :
        undefined
    } } {
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
    public getTableFieldNames<T extends keyof Tables>(tableName: T, version?: number): (keyof Tables[T])[] {
        return Object.keys(this._tables[tableName]).filter(field => {
            if (version == null) {
                return this._tables[tableName][field].toVersion == null
            } else {
                const fromVersion = this._tables[tableName][field].fromVersion;
                if (fromVersion != null && version < fromVersion) {
                    return false;
                }
                const toVersion = this._tables[tableName][field].toVersion;
                if (toVersion != null && toVersion <= version) {
                    return false;
                }
                return true;
            }
        });
    }

    public getFieldTypeName<T extends keyof Tables, F extends keyof Tables[T]>(tableName: T, fieldName: F): Tables[T][F]["type"] {
        return this._tables[tableName][fieldName]["type"];
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
    public validate(): void {
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

    //#region Versioning methods

    /** 
     * Get the list of fields that are new in the given version
     * @param version The version to check
     */
    public getAddedFields(version: number): { [T in keyof Tables]?: (keyof Tables[T])[] } {
        const newFields: { [T in keyof Tables]?: (keyof Tables[T])[] } = {} as any;
        for (const table of this.getTableNames()) {
            for (const field of this.getTableFieldNames(table, version)) {
                const fromFieldVersion = this._tables[table][field].fromVersion;
                if (fromFieldVersion != null && version === fromFieldVersion) {
                    const newFieldsForTable = newFields[table] ?? [];
                    newFieldsForTable.push(field);
                    newFields[table] = newFieldsForTable;
                }
            }
        }
        return newFields;
    }

    /** 
     * Get the list of fields that are removed in the given version
     * @param version The version to check
     */
    public getRemovedFields(version: number): { [T in keyof Tables]?: (keyof Tables[T])[] } {
        const removedFields: { [T in keyof Tables]?: (keyof Tables[T])[] } = {} as any;
        for (const table of this.getTableNames()) {
            // On récupère les champs à la version précédente, parce que si le champ a été supprimé, il n'existe plus à la version actuelle
            for (const field of this.getTableFieldNames(table, version - 1)) {
                const toFieldVersion = this._tables[table][field].toVersion;
                if (toFieldVersion != null && version === toFieldVersion) {
                    const removedFieldsForTable = removedFields[table] ?? [];
                    removedFieldsForTable.push(field);
                    removedFields[table] = removedFieldsForTable;
                }
            }
        }
        return removedFields;
    }

    //#endregion
}

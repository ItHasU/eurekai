import { ForeignKeys, TablesDefinition } from "@dagda/shared/sql/types";
import * as sqlite3 from "promised-sqlite3";

export type SQLValue = number | string | BigInt | Buffer | null;

/** Helper for SQLite database */
export class SQLiteHelper<Tables extends TablesDefinition> {

    protected _db: Promise<sqlite3.AsyncDatabase>;

    constructor(filename: string, protected _foreignKeys: ForeignKeys<Tables>) {
        this._db = sqlite3.AsyncDatabase.open(filename);
    }

    public get db(): Promise<sqlite3.AsyncDatabase> {
        return this._db;
    }

    public get foreignKeys(): ForeignKeys<Tables> { return this._foreignKeys; }

    //#region Table creation --------------------------------------------------

    public async initTable<TN extends keyof Tables, T extends Tables[TN] = Tables[TN]>(
        tableName: TN,
        fieldTypes: { [fields in keyof Required<Omit<T, "id">>]: string }): Promise<void> {
        const fieldTypesFull: { [fields in keyof Required<T>]: string } = {
            "id": "INTEGER PRIMARY KEY AUTOINCREMENT",
            ...fieldTypes
        } as { [fields in keyof Required<T>]: string };
        try {
            await this.run("BEGIN");
            await this._createTableIfNeeded(tableName, fieldTypesFull);
            for (const fieldName in fieldTypesFull) {
                await this._createFieldIfNeeded(tableName, fieldName as keyof Required<T>, fieldTypesFull[fieldName]);
            }
            await this.run("COMMIT");
        } catch (e) {
            console.error(e);
            await this.run("ROLLBACK");
            throw e;
        }
    }

    protected _createTableIfNeeded<TN extends keyof Tables, T extends Tables[TN] = Tables[TN]>(tableName: TN, fieldTypes: { [fields in keyof Required<T>]: string }): Promise<void> {
        return this.run(`CREATE TABLE IF NOT EXISTS ${tableName as string} (${Object.entries(fieldTypes).map(([fieldName, fieldType]) => `'${fieldName}' ${fieldType}`).join(", ")})`, undefined);
    }

    /** @returns true if column was created */
    protected _createFieldIfNeeded<TN extends keyof Tables, T extends Tables[TN] = Tables[TN]>(tableName: TN, fieldName: keyof Required<T>, fieldType: string): Promise<boolean> {
        return this.run(`ALTER TABLE ${tableName as string} ADD COLUMN ${fieldName as string} ${fieldType}`, undefined).catch(() => false).then(() => true);
    }

    //#endregion

    //#region Select ----------------------------------------------------------

    /** Get a list of items */
    public async all<Row>(query: string, params: SQLValue[] = []): Promise<Row[]> {
        try {
            return (await this._db).all<Row>(query, ...params);
        } catch (e) {
            console.error("Failed:", query, params);
            throw e; // Forward error
        }
    }

    /** Get one item if it exists */
    public async get<Row>(query: string, params: SQLValue[] = []): Promise<Row | null> {
        try {
            return (await this._db).get<Row>(query, ...params);
        } catch (e) {
            console.error("Failed:", query, params);
            throw e;
        }
    }

    //#endregion

    //#region Insert ----------------------------------------------------------

    /** Insert an item in the database */
    public async insert(query: string, params: SQLValue[] = []): Promise<number> {
        try {
            await this.run(query, params);
            return (await this.get<{ id: number }>("SELECT last_insert_rowid() AS id", []))?.id ?? -1;
        } catch (e) {
            return Promise.reject(e);
        }
    }

    /** General query */
    public async run(query: string, params: SQLValue[] = []): Promise<void> {
        console.log(query, params);
        try {
            await (await this._db).run(query, ...params);
        } catch (e) {
            return Promise.reject(e);
        }
    }

    //#endregion

}

export function sqlValue(value: any): SQLValue {
    if (value == null) {
        return null;
    }
    switch (typeof value) {
        case "number":
        case "bigint":
        case "string":
            // Returned as-is
            return value;
        case "object":
            // Stringify
            return JSON.stringify(value);
        case "boolean":
        case "symbol":
        case "function":
        default:
            throw new Error(`Value of type ${typeof value} cannot not be used as it cannot be stored in SQLite`);
    }
}
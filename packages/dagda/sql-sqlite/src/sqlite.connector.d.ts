import { SQLTransaction } from "@dagda/sql-shared/src/sql.transaction";
import { SQLConnector, TablesDefinition, TransactionResult } from "@dagda/sql-shared/src/sql.types";
import sqlite from "better-sqlite3";
type SQLValue = number | string | null;
export declare class SQLiteConnector<Tables extends TablesDefinition> implements SQLConnector<Tables> {
    /** The database */
    protected _db: sqlite.Database;
    constructor(filename: string);
    getItems<TableName extends keyof Tables>(tableName: TableName): Promise<Tables[TableName][]>;
    submit(transaction: SQLTransaction<Tables>): Promise<TransactionResult>;
    initTable<TN extends keyof Tables, T extends Tables[TN] = Tables[TN]>(tableName: TN, fieldTypes: {
        [fields in keyof Required<Omit<T, "id">>]: string;
    }): Promise<void>;
    protected _createTableIfNeeded<TN extends keyof Tables, T extends Tables[TN] = Tables[TN]>(tableName: TN, fieldTypes: {
        [fields in keyof Required<T>]: string;
    }): Promise<void>;
    /** @returns true if column was created */
    protected _createFieldIfNeeded<TN extends keyof Tables, T extends Tables[TN] = Tables[TN]>(tableName: TN, fieldName: keyof Required<T>, fieldType: string): Promise<boolean>;
    /** Get rows */
    protected _all<Row>(query: string, params?: SQLValue[]): Promise<Row[]>;
    protected _get<Row>(query: string, params?: SQLValue[]): Promise<Row | null>;
    protected _insert(query: string, params?: SQLValue[]): Promise<number>;
    protected _run(query: string, params?: SQLValue[]): Promise<void>;
}
export {};

import { SQLTransaction } from "./sql.transaction";

/** The minimal fields for an item */
export interface BaseDTO {
    /** Unique auto-incremented id */
    id: number;
}

export type TablesDefinition = Record<string, BaseDTO>;

export interface SQLConnector<Tables extends TablesDefinition> {

    getById<TableName extends keyof Tables>(tableName: TableName, id: number): Promise<Tables[TableName] | undefined>;

    getItems<TableName extends keyof Tables>(tableName: TableName): Promise<Tables[TableName][]>;

    submit(transaction: SQLTransaction<Tables>): Promise<TransactionResult>;
}

export interface TransactionResult {
    updatedIds: { [temporaryId: number]: number };
}
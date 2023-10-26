import { SQLTransaction } from "./sql.transaction";

/** The minimal fields for an item */
export interface BaseDTO {
    /** Unique auto-incremented id */
    id: number;
}

export type TablesDefinition = Record<string, BaseDTO>;

export abstract class SQLConnector<Tables extends TablesDefinition> {

    public abstract getItems<TableName extends keyof Tables>(tableName: TableName): Promise<Tables[TableName][]>;

    public abstract submit(transaction: SQLTransaction<Tables>): Promise<TransactionResult>;
}

export interface TransactionResult {
    updatedIds: { [temporaryId: number]: number };
}
import { SQLTransactionData } from "./sql.transaction";
/** The minimal fields for an item */
export interface BaseDTO {
    /** Unique auto-incremented id */
    id: number;
}
export type TablesDefinition = Record<string, BaseDTO>;
export type ForeignKeys<Tables> = {
    [TableName in keyof Tables]: {
        [field in keyof Required<Omit<Tables[TableName], "id">>]: boolean;
    };
};
export declare abstract class SQLConnector<Tables extends TablesDefinition> {
    protected readonly _foreignKeys: ForeignKeys<Tables>;
    constructor(_foreignKeys: ForeignKeys<Tables>);
    abstract getItems<TableName extends keyof Tables>(tableName: TableName): Promise<Tables[TableName][]>;
    abstract submit(transaction: SQLTransactionData<Tables>): Promise<SQLTransactionResult>;
    /**
     * Update item's foreign keys to new uids.
     * @throws If id cannot be updated.
     */
    protected _updateForeignKeys<TableName extends keyof Tables>(result: SQLTransactionResult, table: TableName, item: Tables[TableName]): void;
    /**
     * Get id updated after insert. If id is positive, it is returned as-is.
     * @throws If id is negative and cannot be updated
     */
    protected _getUpdatedId(result: SQLTransactionResult, id: BaseDTO["id"]): BaseDTO["id"];
}
export interface SQLTransactionResult {
    updatedIds: {
        [temporaryId: number]: number;
    };
}

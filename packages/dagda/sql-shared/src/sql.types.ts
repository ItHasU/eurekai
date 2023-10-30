import { SQLOperation, SQLTransaction, SQLTransactionData } from "./sql.transaction";

/** The minimal fields for an item */
export interface BaseDTO {
    /** Unique auto-incremented id */
    id: number;
}

export type TablesDefinition = Record<string, BaseDTO>;

export type ForeignKeys<Tables> = { [TableName in keyof Tables]: { [field in keyof Required<Omit<Tables[TableName], "id">>]: boolean } };

export abstract class SQLConnector<Tables extends TablesDefinition> {

    constructor(protected readonly _foreignKeys: ForeignKeys<Tables>) { }

    public abstract getItems<TableName extends keyof Tables>(tableName: TableName): Promise<Tables[TableName][]>;

    public abstract submit(transaction: SQLTransactionData<Tables>): Promise<SQLTransactionResult>;

    /** 
     * Update item's foreign keys to new uids.
     * @throws If id cannot be updated.
     */
    protected _updateForeignKeys<TableName extends keyof Tables>(result: SQLTransactionResult, table: TableName, item: Tables[TableName]): void {
        const foreignKeys = this._foreignKeys[table];
        for (const key in foreignKeys) {
            if (foreignKeys[key]) {
                const temporaryId = item[key as keyof Tables[TableName]] as BaseDTO["id"];
                if (temporaryId == null) {
                    continue;
                }
                const newId = this._getUpdatedId(result, temporaryId);
                item[key as keyof Tables[TableName]] = newId as Tables[TableName][keyof Tables[TableName]];
            }
        }
    }

    /** 
     * Get id updated after insert. If id is positive, it is returned as-is.
     * @throws If id is negative and cannot be updated
     */
    protected _getUpdatedId(result: SQLTransactionResult, id: BaseDTO["id"]): BaseDTO["id"] {
        if (id >= 0) {
            return id;
        } else {
            const newId = result.updatedIds[id] ?? id;
            if (newId == null) {
                throw new Error(`Failed to update ${id}`);
            }
            return result.updatedIds[id] ?? id;
        }
    }

}

export interface SQLTransactionResult {
    updatedIds: { [temporaryId: number]: number };
}
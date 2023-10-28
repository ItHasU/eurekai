import { SQLTransaction } from "./sql.transaction";

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

    public abstract submit(transaction: SQLTransaction<Tables>): Promise<TransactionResult>;

    /** 
     * Update item's foreign keys to new uids.
     * @throws If id cannot be updated.
     */
    protected _updateForeignKeys<TableName extends keyof Tables>(result: TransactionResult, table: TableName, item: Tables[TableName]): void {
        const foreignKeys = this._foreignKeys[table];
        for (const key in foreignKeys) {
            if (foreignKeys[key]) {
                const temporaryId = item[key as keyof Tables[TableName]] as BaseDTO["id"];
                if (temporaryId == null || temporaryId >= 0) {
                    continue;
                }
                const newId = result.updatedIds[temporaryId];
                if (newId == null) {
                    throw new Error(`Failed to update ${table as string}.${item.id}.${key}=${temporaryId}`);
                } else {
                    item[key as keyof Tables[TableName]] = newId as Tables[TableName][keyof Tables[TableName]];
                }
            }
        }
    }
}

export interface TransactionResult {
    updatedIds: { [temporaryId: number]: number };
}
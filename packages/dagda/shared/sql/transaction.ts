import { SQLCacheHandler } from "./cache";
import { BaseDTO, TablesDefinition } from "./types";

export enum OperationType {
    INSERT = 1,
    UPDATE,
    DELETE
}

export interface InsertOptions<TableName, DTO> {
    table: TableName;
    item: DTO;
}

export interface UpdateOptions<TableName> {
    table: TableName;
    id: BaseDTO["id"];
    values: Record<string, unknown | null>;
}

export interface DeleteOptions<TableName> {
    table: TableName;
    id: BaseDTO["id"];
}

export type BaseOperation<OT extends OperationType, Options> = { type: OT, options: Options };

export type SQLOperation<Tables extends TablesDefinition, TableName extends keyof Tables> =
    BaseOperation<OperationType.INSERT, InsertOptions<TableName, Tables[TableName]>>
    | BaseOperation<OperationType.UPDATE, UpdateOptions<TableName>>
    | BaseOperation<OperationType.DELETE, DeleteOptions<TableName>>;

export type SQLTransactionData<Tables extends TablesDefinition> = SQLOperation<Tables, keyof Tables>[];

export interface SQLTransactionResult {
    updatedIds: { [temporaryId: number]: number };
}

/**
 * This class will contain a set of operations that will be performed in a transaction.
 * The transaction will apply changes to DTO but changes will only be applied in 
 * database only after the submission.
 */
export class SQLTransaction<Tables extends TablesDefinition> {

    /** List of operations performed */
    public readonly operations: SQLOperation<Tables, keyof Tables>[] = [];

    constructor(protected _cacheHandler: SQLCacheHandler<Tables>) { }

    /** 
     * Insert an item in the database.
     * This function will allocate a temporary negative id.
     */
    public insert<TableName extends keyof Tables, DTO extends Tables[TableName]>(table: TableName, item: Tables[TableName]): void {
        // -- Perform the action on the cache --
        item.id = this._cacheHandler.getNextId();
        this._cacheHandler.getCache(table).insert(item);

        // -- Store the operation --
        this.operations.push({
            type: OperationType.INSERT,
            options: {
                table,
                item: {
                    ...item // Clone the item because if an update occurred later we don't want to set the property yet
                }
            }
        });
    }

    public async update<TableName extends keyof Tables, DTO extends Tables[TableName]>(table: TableName, item: DTO, values: Partial<Omit<DTO, "id">>): Promise<void> {
        // -- Perform the action on the cache --
        const valuesToUpdate: Record<string, unknown | null> = {}
        for (const k in values) {
            const f = k as keyof Partial<Omit<DTO, "id">>;
            item[f] = values[f]!; // We don't care if the value is undefined or not
            valuesToUpdate[k] = values[f] ?? null;
        }

        // -- Store the operation --
        this.operations.push({
            type: OperationType.UPDATE,
            options: {
                table,
                id: item.id,
                values: valuesToUpdate
            }
        });
    }

    public async delete<TableName extends keyof Tables>(table: TableName, id: number): Promise<void> {
        // -- Perform the action on the cache --
        const cache = this._cacheHandler.getCache(table).delete(id)

        // -- Store the operation --
        this.operations.push({
            type: OperationType.DELETE,
            options: {
                table,
                id: id
            }
        });
    }
}

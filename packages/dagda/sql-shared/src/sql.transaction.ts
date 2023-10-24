import { SQLCacheHandler } from "./sql.cache";
import { TablesDefinition } from "./sql.types";

export enum OperationType {
    INSERT = 1,
}

export interface InsertOptions<TableName, DTO> {
    table: TableName;
    item: DTO;
}

export interface Operation<Tables extends TablesDefinition, OT extends OperationType, TableName extends keyof Tables> {
    type: OT;
    options: OperationType.INSERT extends OT ? InsertOptions<TableName, Tables[TableName]>
    : never;
}

/**
 * This class will contain a set of operations that will be performed in a transaction.
 * The transaction will apply changes to DTO but changes will only be applied in 
 * database only after the submission.
 */
export class SQLTransaction<Tables extends TablesDefinition> {

    /** List of operations performed */
    public readonly operations: Operation<Tables, OperationType, keyof Tables>[] = [];

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
                item
            }
        });
    }

    public async update<TableName extends keyof Tables, DTO extends Tables[TableName]>(table: TableName, dto: DTO, values: Partial<Omit<DTO, "id">>): Promise<void> {
        return;
    }

    public async delete<TableName extends keyof Tables>(table: TableName, id: number): Promise<void> {
        return;
    }
}

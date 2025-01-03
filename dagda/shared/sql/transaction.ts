import { EntitiesCacheHandler } from "../entities/cache";
import { asNamed } from "../entities/named.types";
import { BaseEntity, TablesDefinition } from "../entities/types";

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
    id: BaseEntity["id"];
    values: Record<string, unknown | null>;
}

export interface DeleteOptions<TableName> {
    table: TableName;
    id: BaseEntity["id"];
}

export type BaseOperation<OT extends OperationType, Options> = { type: OT, options: Options };

export type SQLOperation<Tables extends TablesDefinition, TableName extends keyof Tables> =
    BaseOperation<OperationType.INSERT, InsertOptions<TableName, Tables[TableName]>>
    | BaseOperation<OperationType.UPDATE, UpdateOptions<TableName>>
    | BaseOperation<OperationType.DELETE, DeleteOptions<TableName>>;

export type SQLTransactionData<Tables extends TablesDefinition, Contexts> = {
    operations: SQLOperation<Tables, keyof Tables>[];
    contexts: Contexts[];
};

export interface SQLTransactionResult {
    updatedIds: { [temporaryId: number]: number };
}

/**
 * This class will contain a set of operations that will be performed in a transaction.
 * The transaction will apply changes to DTO but changes will only be applied in 
 * database only after the submission.
 */
export class SQLTransaction<Tables extends TablesDefinition, Contexts> {

    //#region Temporary ids ---------------------------------------------------

    /** @see _getNextTemporaryId */
    private static _nextTemporaryId: number = 0;

    /** 
     * Get next temporary id. 
     * Temporary ids are negative and replaced by auto generated ids on SQL insert. 
     */
    protected static _getNextTemporaryId(): number {
        return --SQLTransaction._nextTemporaryId;
    }

    /** List of operations performed */
    public readonly operations: SQLOperation<Tables, keyof Tables>[] = [];

    constructor(protected _cacheHandler: EntitiesCacheHandler<Tables>, public readonly contexts: Contexts[]) { }

    /** 
     * Insert an item in the database.
     * This function will allocate a temporary negative id.
     */
    public insert<TableName extends keyof Tables>(table: TableName, item: Tables[TableName]): Tables[TableName] {
        // -- Perform the action on the cache --
        item.id = asNamed(SQLTransaction._getNextTemporaryId());
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
        return item;
    }

    public update<TableName extends keyof Tables, DTO extends Tables[TableName]>(table: TableName, item: DTO, values: Partial<Omit<DTO, "id">>): void {
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

    public delete<TableName extends keyof Tables>(table: TableName, id: number): void {
        // -- Perform the action on the cache --
        this._cacheHandler.getCache(table).delete(id);

        // -- Store the operation --
        this.operations.push({
            type: OperationType.DELETE,
            options: {
                table,
                id: asNamed(id)
            }
        });
    }
}

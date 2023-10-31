import { SQLCacheHandler } from "./sql.cache";
import { BaseDTO, TablesDefinition } from "./sql.types";
export declare enum OperationType {
    INSERT = 1,
    UPDATE = 2,
    DELETE = 3
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
export type BaseOperation<OT extends OperationType, Options> = {
    type: OT;
    options: Options;
};
export type SQLOperation<Tables extends TablesDefinition, TableName extends keyof Tables> = BaseOperation<OperationType.INSERT, InsertOptions<TableName, Tables[TableName]>> | BaseOperation<OperationType.UPDATE, UpdateOptions<TableName>> | BaseOperation<OperationType.DELETE, DeleteOptions<TableName>>;
export type SQLTransactionData<Tables extends TablesDefinition> = SQLOperation<Tables, keyof Tables>[];
export interface SQLTransactionResult {
    updatedIds: {
        [temporaryId: number]: number;
    };
}
/**
 * This class will contain a set of operations that will be performed in a transaction.
 * The transaction will apply changes to DTO but changes will only be applied in
 * database only after the submission.
 */
export declare class SQLTransaction<Tables extends TablesDefinition> {
    protected _cacheHandler: SQLCacheHandler<Tables>;
    /** List of operations performed */
    readonly operations: SQLOperation<Tables, keyof Tables>[];
    constructor(_cacheHandler: SQLCacheHandler<Tables>);
    /**
     * Insert an item in the database.
     * This function will allocate a temporary negative id.
     */
    insert<TableName extends keyof Tables, DTO extends Tables[TableName]>(table: TableName, item: Tables[TableName]): void;
    update<TableName extends keyof Tables, DTO extends Tables[TableName]>(table: TableName, item: DTO, values: Partial<Omit<DTO, "id">>): Promise<void>;
    delete<TableName extends keyof Tables>(table: TableName, id: number): Promise<void>;
}

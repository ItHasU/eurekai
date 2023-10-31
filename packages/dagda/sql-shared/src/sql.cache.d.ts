import { BaseDTO, TablesDefinition } from "./sql.types";
export declare class SQLCache<DTO extends BaseDTO> {
    /** Filter applied to the data (null means no data loaded) */
    private _filter;
    /** List of items */
    private readonly _items;
    constructor();
    getById(id: number): DTO | undefined;
    getItems(): DTO[];
    setItems(items: DTO[]): void;
    insert(item: DTO): void;
    delete(id: BaseDTO["id"]): void;
}
export interface SQLCacheHandler<Tables extends TablesDefinition> {
    /** Get a new id for the next DTO created */
    getNextId(): BaseDTO["id"];
    /** Get or build an empty cache */
    getCache<TableName extends keyof Tables>(tableName: TableName): SQLCache<Tables[TableName]>;
}

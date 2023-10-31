import { BaseDTO, TablesDefinition } from "./types";

export class SQLCache<DTO extends BaseDTO> {
    /** Filter applied to the data (null means no data loaded) */
    private _filter: Partial<Omit<DTO, "id">> | null = null;

    /** List of items */
    private readonly _items: Map<number, DTO> = new Map();

    constructor() { }

    public getById(id: number): DTO | undefined {
        return this._items.get(id);
    }

    public getItems(): DTO[] {
        return [...this._items.values()];
    }

    public setItems(items: DTO[]): void {
        this._items.clear();
        for (const item of items) {
            this._items.set(item.id, item);
        }
    }

    public insert(item: DTO): void {
        this._items.set(item.id, item);
    }

    public delete(id: BaseDTO["id"]): void {
        this._items.delete(id);
    }

}

export interface SQLCacheHandler<Tables extends TablesDefinition> {

    /** Get a new id for the next DTO created */
    getNextId(): BaseDTO["id"];

    /** Get or build an empty cache */
    getCache<TableName extends keyof Tables>(tableName: TableName): SQLCache<Tables[TableName]>
}

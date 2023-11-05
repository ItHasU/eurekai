import { BaseDTO, TablesDefinition } from "./types";

export class SQLCache<DTO extends BaseDTO> {
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

    /** Get or build an empty cache */
    getCache<TableName extends keyof Tables>(tableName: TableName): SQLCache<Tables[TableName]>
}

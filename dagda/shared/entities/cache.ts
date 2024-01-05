

export class EntityCache<Entity> {
    /** List of items */
    private readonly _items: Map<number, Entity> = new Map();

    constructor(protected _idField: string) { }

    public getById(id: number): Entity | undefined {
        return this._items.get(id);
    }

    public getItems(): Entity[] {
        return [...this._items.values()];
    }

    public setItems(items: Entity[]): void {
        this._items.clear();
        for (const item of items) {
            this._items.set((item as any)[this._idField], item);
        }
    }

    public insert(item: Entity): void {
        this._items.set((item as any)[this._idField], item);
    }

    public delete(id: number): void {
        this._items.delete(id);
    }

}

export interface SQLCacheHandler<Tables extends TablesDefinition> {

    /** Get or build an empty cache */
    getCache<TableName extends keyof Tables>(tableName: TableName): SQLCache<Tables[TableName]>
}

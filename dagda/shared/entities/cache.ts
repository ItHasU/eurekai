import { BaseEntity, TablesDefinition } from "./types";

/** Cache for fetched entities from a table */
export class EntitiesCache<Entity extends BaseEntity> {

    /** List of items */
    private readonly _items: Map<number, Entity> = new Map();

    constructor() { }

    public getById(id: number): Entity | undefined {
        return this._items.get(id);
    }

    public getItems(): Entity[] {
        return [...this._items.values()];
    }

    public setItems(items: Entity[]): void {
        this._items.clear();
        for (const item of items) {
            this._items.set(item.id, item);
        }
    }

    public insert(item: Entity): void {
        this._items.set(item.id, item);
    }

    public delete(id: number): void {
        this._items.delete(id);
    }

}

/** Gather caches for all tables */
export interface EntitiesCacheHandler<Tables extends TablesDefinition> {

    /** Get or build an empty cache */
    getCache<TableName extends keyof Tables>(tableName: TableName): EntitiesCache<Tables[TableName]>
}

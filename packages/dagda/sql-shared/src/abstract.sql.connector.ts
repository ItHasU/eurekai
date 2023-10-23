/** The minimal fields for an item */
export interface BaseDTO {
    /** Unique auto-incremented id */
    id: number;
}

export type TablesDefinition = Record<string, BaseDTO>;

class Cache<DTO extends BaseDTO> {
    /** Filter applied to the data (null means no data loaded) */
    private _filter: Partial<Omit<DTO, "id">> | null = null;

    /** List of items */
    private readonly _items: Map<number, DTO> = new Map();

    constructor() {}

    public getById(id: number): DTO | undefined {
        return this._items.get(id);
    }

    public insert(item: DTO): void {
        this._items.set(item.id, item);
    }

}

/**  */
export abstract class AbstractSQLConnector<Tables extends TablesDefinition> {

    /** 
     * Is cache dirty
     * If true, the cache will be erased on next get.
     */
    protected _cacheDirty: boolean = false;

    /** Les caches de chaque table */
    protected readonly _caches: { [TableName in keyof Tables]?: Cache<Tables[TableName]> } = {};

    constructor() { }

    public markCacheDirty(): void {
        this._cacheDirty = true;
    }

    /** Get or build an empty cache */
    protected _getCache<TableName extends keyof Tables>(tableName: TableName): Cache<Tables[TableName]> {
        let cache: Cache<Tables[TableName]> | undefined = this._caches[tableName];
        if (cache == null) {
            this._caches[tableName] = cache = new Cache();
        }
        return cache;
    }

    /** 
     * Fetch items from the db based on the provided filter.
     * You cannot filter on id, if you want a specific id, use getById.
     * 
     * This method will check if any previous is already present and covering the requested filter.
     * If this is not the case, the cache is replaced.
     */
    public async getItems<TableName extends keyof Tables, DTO extends Tables[TableName]>(filter: Partial<Omit<Tables[TableName], "id">>): Promise<DTO[]> {
        return [];
    }

    /** 
     * Get an item from cache or fetch from the server.
     * For efficiency, you should always pre-fetch as many items as possible with getItems().
    */
    public async getById<TableName extends keyof Tables, DTO extends Tables[TableName]>(tableName: TableName, id: number): Promise<DTO | undefined> {
        // -- First, search in the cache --
        const cache = this._getCache(tableName);
        const itemInCache = cache.getById(id);
        if (itemInCache != null) {
            // We found the item in the cache, jackpot
            return itemInCache as DTO;
        }

        // -- If not found request the item from the server --
        const item = await this._getById(tableName, id) as DTO | undefined;
        if (item != null) {
            cache.insert(item);
        }
        return item;
    }

    /** Insert an item in the database */
    public async insert<TableName extends keyof Tables, DTO extends Tables[TableName]>(table: TableName, dto: DTO): Promise<DTO> {
        return { ...dto, id: -1 } as DTO;
    }

    public async update<TableName extends keyof Tables, DTO extends Tables[TableName]>(table: TableName, dto: DTO, values: Partial<Omit<DTO, "id">>): Promise<void> {
        return;
    }

    public async delete<TableName extends keyof Tables>(table: TableName, id: number): Promise<void> {
        return;
    }

    //#region Abstract services -----------------------------------------------

    protected abstract _getById<TableName extends keyof Tables, DTO extends Tables[TableName]>(tableName: TableName, id: number): Promise<DTO | undefined>;

    //#endregion
}

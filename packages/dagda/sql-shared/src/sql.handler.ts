import { SQLCache } from "./sql.cache";
import { SQLConnector, TablesDefinition } from "./sql.types";

/** 
 * Utility class allowing to fetch data and store them in a cache.
 * The cache can then be accessed through synchronous methods.
 */
export class SQLHandler<Tables extends TablesDefinition> {

    /** 
     * Is cache dirty
     * If true, the cache will be erased on next get.
     */
    protected _cacheDirty: boolean = false;

    /** Les caches de chaque table */
    protected readonly _caches: { [TableName in keyof Tables]?: SQLCache<Tables[TableName]> } = {};

    constructor(protected _connector: SQLConnector<Tables>) { }

    //#region Cache -----------------------------------------------------------

    public markCacheDirty(): void {
        this._cacheDirty = true;
    }

    /** Load the full table */
    public async loadTable(tableName: (keyof Tables)): Promise<void> {
        const items = await this._connector.getItems(tableName);
        this._getCache(tableName).setItems(items);
    }

    /** Get or build an empty cache */
    protected _getCache<TableName extends keyof Tables>(tableName: TableName): SQLCache<Tables[TableName]> {
        let cache: SQLCache<Tables[TableName]> | undefined = this._caches[tableName];
        if (cache == null) {
            this._caches[tableName] = cache = new SQLCache();
        }
        return cache;
    }

    //#endregion


    //#region Get item(s) from the cache --------------------------------------

    /** 
     * Get an item from cache or fetch from the server.
     * For efficiency, you should always pre-fetch as many items as possible with getItems().
    */
    public getById<TableName extends keyof Tables>(tableName: TableName, id: number): Tables[TableName] | undefined {
        // -- First, search in the cache --
        return this._getCache(tableName).getById(id);
    }

    /** 
     * Fetch items from the db based on the provided filter.
     * You cannot filter on id, if you want a specific id, use getById.
     * 
     * This method will check if any previous is already present and covering the requested filter.
     * If this is not the case, the cache is replaced.
     */
    public getItems<TableName extends keyof Tables>(tableName: TableName): Tables[TableName][] {
        return this._getCache(tableName).getItems();
    }

    //#endregion


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

    //#endregion
}

import { SQLCache } from "./cache";
import { SQLTransactionData } from "./transaction";

/** The minimal fields for an item */
export interface BaseDTO {
    /** Unique auto-incremented id */
    id: number;
}

export type TablesDefinition = Record<string, BaseDTO>;

export type ForeignKeys<Tables> = { [TableName in keyof Tables]: { [field in keyof Required<Omit<Tables[TableName], "id">>]: boolean } };

/**
 * Abstract connector.
 */
export abstract class SQLConnector<Tables extends TablesDefinition> {

    constructor(protected readonly _foreignKeys: ForeignKeys<Tables>) { }

    public abstract submit(transaction: SQLTransactionData<Tables>): Promise<SQLTransactionResult>;

    /** 
     * Update item's foreign keys to new uids.
     * @throws If id cannot be updated.
     */
    protected _updateForeignKeys<TableName extends keyof Tables>(result: SQLTransactionResult, table: TableName, item: Tables[TableName]): void {
        const foreignKeys = this._foreignKeys[table];
        for (const key in foreignKeys) {
            if (foreignKeys[key]) {
                const temporaryId = item[key as keyof Tables[TableName]] as BaseDTO["id"];
                if (temporaryId == null) {
                    continue;
                }
                const newId = this._getUpdatedId(result, temporaryId);
                item[key as keyof Tables[TableName]] = newId as Tables[TableName][keyof Tables[TableName]];
            }
        }
    }

    /** 
     * Get id updated after insert. If id is positive, it is returned as-is.
     * @throws If id is negative and cannot be updated
     */
    protected _getUpdatedId(result: SQLTransactionResult, id: BaseDTO["id"]): BaseDTO["id"] {
        if (id >= 0) {
            return id;
        } else {
            const newId = result.updatedIds[id] ?? id;
            if (newId == null) {
                throw new Error(`Failed to update ${id}`);
            }
            return result.updatedIds[id] ?? id;
        }
    }

}

export interface SQLTransactionResult {
    updatedIds: { [temporaryId: number]: number };
}

//#region Fetcher -------------------------------------------------------------

/** 
 * Return type for the fetch function.
 * This structure can contain a list of items fetched from the database.
 * Those items will be merged in the current cache.
 */
export type Data<Tables extends TablesDefinition> = { [TableName in keyof Tables]?: Tables[TableName][] };

export type FilterEquals<Filter> = (newFilter: Filter, oldFilter: Filter) => boolean;

export type Fetcher<Tables extends TablesDefinition, Filter> = (filter: Filter) => Promise<Data<Tables>>;

export class SQLFetcher<Tables extends TablesDefinition, Filter> {

    /** List of filters loaded */
    protected _filters: Filter[] = [];

    /** If true, the cache will be erased on next fetch. */
    protected _cacheDirty: boolean = false;

    /** Les caches de chaque table */
    protected _caches: { [TableName in keyof Tables]?: SQLCache<Tables[TableName]> } = {};

    constructor(protected _options: {
        equals: FilterEquals<Filter>;
        fetch: Fetcher<Tables, Filter>;
    }) { }

    //#region Cache handling --------------------------------------------------

    /** Force cache clear on next fetch */
    public markCacheDirty(): void {
        this._cacheDirty = true;
    }

    /** Get or build an empty cache */
    public getCache<TableName extends keyof Tables>(tableName: TableName): SQLCache<Tables[TableName]> {
        let cache: SQLCache<Tables[TableName]> | undefined = this._caches[tableName];
        if (cache == null) {
            this._caches[tableName] = cache = new SQLCache();
        }
        return cache;
    }

    /** Fetch data */
    public async fetch(filters: Filter[]): Promise<void> {
        if (this._cacheDirty) {
            // Clear all
            this._filters = [];
            this._caches = {};
        }

        // -- Keep filters that needs to be fetched --
        const filtersToFetch: Filter[] = [];
        for (const newFilter of filters) {
            let hasFilter = false;
            for (const oldFilter of this._filters) {
                hasFilter = this._options.equals(newFilter, oldFilter);
                if (hasFilter) {
                    break;
                }
            }
            if (!hasFilter) {
                // Filter if not found
                this._filters.push(newFilter);
                filtersToFetch.push(newFilter);
            }
        }

        try {
            for (const filter of filtersToFetch) {
                const result = await this._options.fetch(filter);
                // Merge loaded items with current cache
                for (const [table, items] of Object.entries(result)) {
                    const cache = this.getCache(table);
                    // Here it is important to insert all items instead of set
                    // because we want to complete the cache
                    for (const item of items) {
                        cache.insert(item); // Add or override previous value
                    }
                }
            }
        } catch (e) {
            this._cacheDirty = true;
            throw e;
        }
        // All done, cache is ok
        this._cacheDirty = false;
    }

}

//#endregion
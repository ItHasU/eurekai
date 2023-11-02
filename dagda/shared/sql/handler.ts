import { EventHandler, EventHandlerData, EventHandlerImpl, EventListener } from "../tools/events";
import { SQLCache, SQLCacheHandler } from "./cache";
import { OperationType, SQLTransaction } from "./transaction";
import { SQLAdapter, TablesDefinition } from "./types";

type SQLEvents = {
    "state": {
        /** 
         * Is the handler currently loading data ?
         * (ex: during loadTable()) 
         */
        downloading: boolean,
        /**
         * Is the handler currently sending data ?
         * (ex: during submit())
         */
        uploading: boolean
    }
}


/** 
 * Utility class allowing to fetch data, store them in a cache and submit modifications.  
 * The cache can then be accessed through synchronous methods.
 */
export class SQLHandler<Tables extends TablesDefinition, Filter> implements SQLCacheHandler<Tables>, EventHandler<SQLEvents> {

    /** List of filters loaded */
    protected _filters: Filter[] = [];
    /** If true, the cache will be erased on next fetch. */
    protected _cacheDirty: boolean = false;
    /** Les caches de chaque table */
    protected _caches: { [TableName in keyof Tables]?: SQLCache<Tables[TableName]> } = {};

    /** Current state of the temporary id counter */
    protected _nextId: number = 0;

    constructor(protected _adapter: SQLAdapter<Tables, Filter>) { }

    //#region Events ----------------------------------------------------------

    protected readonly _eventHandlerData: EventHandlerData<SQLEvents> = {};

    protected _state: SQLEvents["state"] = {
        downloading: false,
        uploading: false
    };

    /** @inheritdoc */
    public on<EventName extends keyof SQLEvents>(eventName: EventName, listener: EventListener<SQLEvents[EventName]>): void {
        // Call default implementation
        EventHandlerImpl.on(this._eventHandlerData, eventName, listener);
    }

    /** Utility method update the current state and fire an event */
    protected _fireStateChanged(update: Partial<SQLEvents["state"]>): void {
        this._state = {
            // Keep previous state
            ...this._state,
            // Override with new values
            ...update
        };
        EventHandlerImpl.fire(this._eventHandlerData, "state", this._state);
    }

    //#endregion

    //#region Cache -----------------------------------------------------------

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
        this._fireStateChanged({ downloading: true });

        try {
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
                    hasFilter = this._adapter.filterEquals(newFilter, oldFilter);
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

            for (const filter of filtersToFetch) {
                const result = await this._adapter.fetch(filter);
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
            // All done, cache is ok
            this._cacheDirty = false;
        } catch (e) {
            this._cacheDirty = true;
            throw e;
        } finally {
            this._fireStateChanged({ downloading: false });
        }
    }

    /** 
     * Get an item from cache or fetch from the server.
     * For efficiency, you should always pre-fetch as many items as possible with getItems().
    */
    public getById<TableName extends keyof Tables>(tableName: TableName, id: number): Tables[TableName] | undefined {
        // -- First, search in the cache --
        return this.getCache(tableName).getById(id);
    }

    /** 
     * Fetch items from the db based on the provided filter.
     * You cannot filter on id, if you want a specific id, use getById.
     * 
     * This method will check if any previous is already present and covering the requested filter.
     * If this is not the case, the cache is replaced.
     */
    public getItems<TableName extends keyof Tables>(tableName: TableName): Tables[TableName][] {
        return this.getCache(tableName).getItems();
    }

    //#endregion

    //#region Transactions ----------------------------------------------------

    /** 
     * Submit the transaction to the connector.
     * Once the result is received, the cache is updated
     */
    public async submit(transaction: SQLTransaction<Tables>): Promise<void> {
        this._fireStateChanged({ uploading: true });
        try {
            // -- Call submit on the connector --
            const result = await this._adapter.submit(transaction.operations);
            // -- Once done, update local DTO --
            for (const op of transaction.operations) {
                switch (op.type) {
                    case OperationType.INSERT:
                        const tmpId = op.options.item.id;
                        if (tmpId < 0) {
                            const cache = this.getCache(op.options.table);
                            const item = cache.getById(tmpId);
                            cache.delete(tmpId); // Delete old item
                            if (item) {
                                // Update the id
                                item.id = result.updatedIds[tmpId];
                                // Make sure the item is registered
                                cache.insert(item);
                            }
                        }
                        break;
                    default:
                        break;
                }
            }
        } finally {
            this._fireStateChanged({ uploading: false });
        }
    }

    //#endregion

}

import { EventHandler, EventHandlerData, EventHandlerImpl, EventListener } from "../tools/events";
import { SQLCache, SQLCacheHandler } from "./cache";
import { OperationType, SQLTransaction } from "./transaction";
import { SQLAdapter, TablesDefinition } from "./types";

export type SQLEvents = {
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
        uploading: boolean,
        /**
         * Is the cache dirty ?
         * (ex: after an error or during a refresh)
         */
        dirty: boolean
    }
}


/** 
 * Utility class allowing to fetch data, store them in a cache and submit modifications.  
 * The cache can then be accessed through synchronous methods.
 */
export class SQLHandler<Tables extends TablesDefinition, Contexts> implements SQLCacheHandler<Tables>, EventHandler<SQLEvents> {

    /** List of filters loaded */
    protected _loadedContexts: Contexts[] = [];
    /** If true, the cache will be erased on next fetch. */
    protected _cacheDirty: boolean = false;
    /** One cache per table */
    protected _caches: { [TableName in keyof Tables]?: SQLCache<Tables[TableName]> } = {};

    /** Current state of the temporary id counter */
    protected _nextId: number = 0;

    constructor(protected _adapter: SQLAdapter<Tables, Contexts>) { }

    //#region Events ----------------------------------------------------------

    protected readonly _eventHandlerData: EventHandlerData<SQLEvents> = {};

    protected _state: SQLEvents["state"] = {
        downloading: false,
        uploading: false,
        dirty: false
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
        this._fireStateChanged({
            dirty: true
        });
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
    public async fetch(...contexts: Contexts[]): Promise<void> {

        try {
            if (this._cacheDirty) {
                // Clear all
                this._loadedContexts = [];
                this._caches = {};
            }

            // -- Keep filters that needs to be fetched --
            const contextsToFetch: Contexts[] = [];
            for (const newContext of contexts) {
                let hasContext = false;
                for (const oldContext of this._loadedContexts) {
                    hasContext = this._adapter.contextEquals(newContext, oldContext);
                    if (hasContext) {
                        break;
                    }
                }
                if (!hasContext) {
                    // Context is not found
                    this._loadedContexts.push(newContext);
                    contextsToFetch.push(newContext);
                }
            }

            if (contextsToFetch.length > 0) {
                this._fireStateChanged({ downloading: true });
                for (const filter of contextsToFetch) {
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
                this._fireStateChanged({ downloading: false });
            }
            // All done, cache is ok
            this._cacheDirty = false;
            this._fireStateChanged({ dirty: false });
        } catch (e) {
            this._cacheDirty = true;
            this._fireStateChanged({ dirty: true });
            throw e;
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
     * Execute f() with a new transaction.
     * Once the execution of f() is done, the transaction is automatically submitted to the server.  
     * 
     * The function will resolve once the transaction is submitted, but before the server has responded.
     */
    public async withTransaction(f: (transaction: SQLTransaction<Tables>) => Promise<void> | void) {
        // -- Create transaction and run f() --
        const tr = new SQLTransaction<Tables>(this);
        try {
            await f(tr);
        } catch (e) {
            console.error(e);
            this.markCacheDirty();
            throw e;
        }
        // -- Submit transaction to the server --
        // Here, we don't wait for the promise to resolve
        this.submit(tr).catch(e => {
            console.error(e);
            this.markCacheDirty();
        });
    }

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
        } catch (e) {
            console.error(e);
            this._cacheDirty = true;
            this._fireStateChanged({ dirty: true });
        } finally {
            this._fireStateChanged({ uploading: false });
        }
    }

    //#endregion

}

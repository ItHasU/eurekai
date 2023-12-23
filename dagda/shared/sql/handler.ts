import { Queue } from "@dagda/shared/tools/queue";
import { EventHandler, EventHandlerData, EventHandlerImpl, EventListener } from "../tools/events";
import { SQLCache, SQLCacheHandler } from "./cache";
import { OperationType, SQLTransaction } from "./transaction";
import { ForeignKeys, SQLAdapter, TablesDefinition } from "./types";

export type SQLEvents = {
    "state": {
        /** 
         * Is the handler currently loading data ?
         * (ex: during loadTable()) 
         */
        downloading: number,
        /**
         * Is the handler currently sending data ?
         * (ex: during submit())
         */
        uploading: number,
        /**
         * Is the cache dirty ?
         * (ex: after an error or during a refresh)
         */
        dirty: boolean
    }
}

interface ContextState<Contexts> {
    /** Loaded context */
    context: Contexts,
    /** 
     * Is the loaded context currently active ?
     * If true, the context will be marked as dirty on other clients on next transaction.
     */
    active: boolean,
    /**
     * Is the cache dirty ?
     * Will be true if another client has modified a data matching the context.
     */
    dirty: boolean
}

/** 
 * Utility class allowing to fetch data, store them in a cache and submit modifications.  
 * The cache can then be accessed through synchronous methods.
 */
export class SQLHandler<Tables extends TablesDefinition, Contexts> implements SQLCacheHandler<Tables>, EventHandler<SQLEvents> {

    /** List of contexts loaded */
    protected _loadedContexts: ContextState<Contexts>[] = [];

    /** One cache per table */
    protected _caches: { [TableName in keyof Tables]?: SQLCache<Tables[TableName]> } = {};

    /** Current state of the temporary id counter */
    protected _nextId: number = 0;
    /** History of updated ids */
    protected _updatedIds: { [originalId: number]: number } = {};

    /** Queue for submit of transactions */
    protected _submitQueue: Queue<void> = new Queue(void (0));

    constructor(protected _adapter: SQLAdapter<Tables, Contexts>, protected _foreignKeys: ForeignKeys<Tables>) { }

    //#region Events ----------------------------------------------------------

    protected readonly _eventHandlerData: EventHandlerData<SQLEvents> = {};

    protected _state: SQLEvents["state"] = {
        downloading: 0,
        uploading: 0,
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
    public markCacheDirty(...contexts: Contexts[]): void {
        let hasDirtyContext = false;
        if (contexts.length === 0) {
            // Mark all contexts as dirty
            for (const context of this._loadedContexts) {
                context.dirty = true;
                hasDirtyContext = true;
            }
        } else {
            // Only mark contexts intersecting with the provided contexts as dirty
            for (const context of contexts) {
                for (const loadedContext of this._loadedContexts) {
                    if (this._adapter.contextIntersects(context, loadedContext.context)) {
                        loadedContext.dirty = true;
                        hasDirtyContext = true;
                    }
                }
            }
        }

        this._fireStateChanged({
            dirty: hasDirtyContext
        });
    }

    /** Get the list of active contexts (either dirty or not) */
    public getActiveContexts(): Contexts[] {
        const activeContexts: Contexts[] = [];
        for (const context of this._loadedContexts) {
            if (context.active) {
                activeContexts.push(context.context);
            }
        }
        return activeContexts;
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
    public async fetch(...contextsToLoad: Contexts[]): Promise<void> {
        this._fireStateChanged({ downloading: this._state.downloading + 1 });
        try {
            // -- Make a list of contexts to fetch --
            const contextsToFetch: Set<Contexts> = new Set();
            const statesToMarkActiveAndNotDirty: Set<ContextState<Contexts>> = new Set();

            for (const contextToLoad of contextsToLoad) {
                // Seek for existing context matching the context to load
                let contextAlreadyExisting = false;
                for (const existingState of this._loadedContexts) {
                    if (this._adapter.contextEquals(contextToLoad, existingState.context)) {
                        contextAlreadyExisting = true;
                        statesToMarkActiveAndNotDirty.add(existingState);
                        if (existingState.dirty) {
                            // Context is loaded but dirty
                            contextsToFetch.add(contextToLoad);
                        }
                    }
                }

                if (!contextAlreadyExisting) {
                    // We don't have any context matching the context to load
                    // We need to fetch it
                    contextsToFetch.add(contextToLoad);
                    const newState: ContextState<Contexts> = {
                        context: contextToLoad,
                        active: false,
                        dirty: false
                    };
                    this._loadedContexts.push(newState);
                    statesToMarkActiveAndNotDirty.add(newState);
                }
            }

            // -- Fetch the missing contexts --
            for (const context of contextsToFetch) {
                const result = await this._adapter.fetch(context);
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

            // -- Once all contexts are loaded, mark them as active and not dirty --
            for (const state of this._loadedContexts) {
                if (statesToMarkActiveAndNotDirty.has(state)) {
                    state.active = true;
                    state.dirty = false;
                } else {
                    state.active = false;
                    // Keep dirty as-is
                }
            }

            // All done, cache is ok
            this._fireStateChanged({ dirty: false });
        } catch (e) {
            this._loadedContexts = [];
            this._fireStateChanged({ dirty: true });
            throw e;
        } finally {
            this._fireStateChanged({ downloading: this._state.downloading - 1 });
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
    public async withTransaction(f: (transaction: SQLTransaction<Tables, Contexts>) => Promise<void> | void) {
        // -- Create transaction and run f() --
        const tr = new SQLTransaction<Tables, Contexts>(this, this.getActiveContexts());
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
    public async submit(transaction: SQLTransaction<Tables, Contexts>): Promise<void> {
        this._fireStateChanged({ uploading: this._state.uploading + 1 });
        try {
            await this._submitQueue.run(async () => {
                // -- Make sure to update the ids before sending --
                for (const op of transaction.operations) {
                    switch (op.type) {
                        case OperationType.INSERT:
                            this._updateIds(op.options.table, op.options.item, { skipId: true });
                            break;
                        case OperationType.UPDATE:
                            this._updateIds(op.options.table, op.options.values as any);
                            break;
                        case OperationType.DELETE:
                            op.options.id = this.getUpdatedId(op.options.id)!;
                            break;
                        default:
                            break;
                    }
                }
                // -- Call submit on the connector --
                const result = await this._adapter.submit(transaction.operations, transaction.contexts);
                // -- Store updated ids --
                // This needs to be done before updating the items
                for (const originalId in result.updatedIds) {
                    const updatedId = result.updatedIds[originalId];
                    if (updatedId == null) {
                        continue;
                    }
                    this._updatedIds[originalId] = updatedId;
                }
                // -- Update local items --
                for (const op of transaction.operations) {
                    switch (op.type) {
                        case OperationType.INSERT:
                            this._updateIds(op.options.table, op.options.item);
                            break;
                        default:
                            break;
                    }
                }
            });
        } catch (e) {
            console.error(e);
            this.markCacheDirty();
            throw e;
        } finally {
            this._fireStateChanged({ uploading: this._state.uploading - 1 });
        }
    }

    //#endregion

    //#region Id handling -----------------------------------------------------

    /** 
     * @returns true if ids match.
     * This function compare ids and temporary ids.
     * There is no verification if the ids are from the same table.
     */
    public isSameId(id1: number | null | undefined, id2: number | null | undefined): boolean {
        return this.getUpdatedId(id1) == this.getUpdatedId(id2);
    }

    public getUpdatedId(id: number | null | undefined): number | null | undefined {
        if (id == null) {
            return null;
        } else {
            return this._updatedIds[id] ?? id;
        }
    }

    protected _updateIds<TableName extends keyof Tables>(
        table: TableName,
        item: Partial<Tables[TableName]>,
        options?: {
            /** If enabled, won't update the id field, for insertion */
            skipId?: boolean
        }
    ): void {
        // -- Update fields ---------------------------------------------------
        for (const field in item) {
            if (field === "id") {
                if (options?.skipId) {
                    // Don't update the id yet
                } else {
                    const tmpId = item.id;
                    if (tmpId != null && tmpId < 0) {
                        const cache = this.getCache(table);
                        const item = cache.getById(tmpId);
                        cache.delete(tmpId); // Delete old item
                        if (item) {
                            // Update the id
                            item.id = this.getUpdatedId(tmpId)!;
                            // Make sure the item is registered
                            cache.insert(item);
                        }
                    }
                }
            } else {
                const foreignKeys = this._foreignKeys[table];
                const foreignTable: boolean = (foreignKeys as any)[field];
                if (foreignTable) {
                    const tmpId = item[field] as number | null | undefined;
                    if (tmpId != null && tmpId < 0) {
                        if (item) {
                            // Update the id
                            item[field] = this.getUpdatedId(tmpId) as any;
                        }
                    }
                }
            }
        }
    }

    //#endregion
}

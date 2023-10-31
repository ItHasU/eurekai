import { EventHandler, EventHandlerData, EventHandlerImpl, EventListener } from "@dagda/tools/src/events.tools";
import { SQLCache, SQLCacheHandler } from "./sql.cache";
import { OperationType, SQLTransaction } from "./sql.transaction";
import { SQLConnector, TablesDefinition } from "./sql.types";

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
 * Utility class allowing to fetch data and store them in a cache.
 * The cache can then be accessed through synchronous methods.
 */
export class SQLHandler<Tables extends TablesDefinition> implements SQLCacheHandler<Tables>, EventHandler<SQLEvents> {

    /** 
     * Is cache dirty
     * If true, the cache will be erased on next get.
     */
    protected _cacheDirty: boolean = false;

    protected _nextId: number = 0;

    /** Les caches de chaque table */
    protected readonly _caches: { [TableName in keyof Tables]?: SQLCache<Tables[TableName]> } = {};

    constructor(protected _connector: SQLConnector<Tables>) { }

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

    public getNextId(): number {
        return --this._nextId;
    }

    public markCacheDirty(): void {
        this._cacheDirty = true;
    }

    /** Load the full table */
    public async loadTable(tableName: (keyof Tables)): Promise<void> {
        this._fireStateChanged({ downloading: true });
        const items = await this._connector.getItems(tableName);
        this.getCache(tableName).setItems(items);
        this._fireStateChanged({ downloading: false });
    }

    /** Get or build an empty cache */
    public getCache<TableName extends keyof Tables>(tableName: TableName): SQLCache<Tables[TableName]> {
        let cache: SQLCache<Tables[TableName]> | undefined = this._caches[tableName];
        if (cache == null) {
            this._caches[tableName] = cache = new SQLCache();
        }
        return cache;
    }

    //#endregion

    //#region Transactions ----------------------------------------------------

    /** 
     * Submit the transaction to the connector.
     * Once the result is received, the cache is updated
     */
    public async submit(transaction: SQLTransaction<Tables>): Promise<void> {
        this._fireStateChanged({ uploading: true });
        // -- Call submit on the connector --
        const result = await this._connector.submit(transaction.operations);
        // -- Once done, update local DTO --
        for (const op of transaction.operations) {
            switch (op.type) {
                case OperationType.INSERT:
                    const tmpId = op.options.item.id;
                    if (tmpId < 0) {
                        const item = this.getCache(op.options.table).getById(tmpId);
                        if (item) {
                            // Update the id
                            item.id = result.updatedIds[tmpId];
                            // Make sure the item is registered
                            this.getCache(op.options.table).insert(item);
                        }
                    }
                    break;
                default:
                    break;
            }
        }
        this._fireStateChanged({ uploading: false });
    }

    //#endregion

    //#region Get item(s) from the cache --------------------------------------

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

}

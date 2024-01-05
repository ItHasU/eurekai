import { SQLTransactionData } from "../sql/transaction";
import { Named } from "./named.types";

// This file contains types to be used externally by the application.

//#region Events --------------------------------------------------------------

/** The handler will register on these events on the NotificationService to keep updated of changes */
export type ContextEvents<Contexts> = {
    "contextChanged": Contexts[];
};

/** Events fired by the handler to let you know what's happening */
export type EntitiesEvents = {
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

//#endregion

//#region Definitions ---------------------------------------------------------

/** The minimal fields for an item */
export interface BaseEntity {
    /** Unique auto-incremented id */
    id: Named<string, number>;
}

/** Retrieved from the EntitiesModel */
export type TablesDefinition = Record<string, BaseEntity>;

/** Retrieved from the EntitiesModel */
export type ForeignKeys<Tables> = { [TableName in keyof Tables]: { [field in keyof Tables[TableName]]?: keyof Tables } };

//#endregion

//#region Adapter -------------------------------------------------------------

/** 
 * Return type for the fetch function.
 * This structure can contain a list of items fetched from the database.
 * Those items will be merged in the current cache.
 */
export type Data<Tables extends TablesDefinition> = { [TableName in keyof Tables]?: Tables[TableName][] };

/**
 * Return type of the submit function.  
 * Get the results of the inserts performed.
 */
export interface SQLTransactionResult {
    updatedIds: { [temporaryId: number]: number };
}

/**
 * The adapter provides services for the handler to :
 * - fetch data from a given context,
 * - and submit modifications applied locally.
 */
export interface SQLAdapter<Tables extends TablesDefinition, Contexts> {
    /** 
     * Compare filter.
     * MUST BE executable locally without a promise for quick performances.
     */
    contextEquals(newContext: Contexts, oldContext: Contexts): boolean;

    /** 
     * @returns true if the new context intersects the old context.
     * MUST BE executable locally without a promise for quick performances.
     */
    contextIntersects(newContext: Contexts, oldContext: Contexts): boolean;

    /** Fetch data corresponding to filter */
    fetch(context: Contexts): Promise<Data<Tables>>;

    /** Submit changes in the transaction */
    submit(transactionData: SQLTransactionData<Tables, Contexts>): Promise<SQLTransactionResult>;
}

//#endregion
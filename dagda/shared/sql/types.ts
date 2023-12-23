import { SQLTransactionData } from "./transaction";

/** The minimal fields for an item */
export interface BaseDTO {
    /** Unique auto-incremented id */
    id: number;
}

export type TablesDefinition = Record<string, BaseDTO>;

export type ForeignKeys<Tables> = { [TableName in keyof Tables]: { [field in keyof Required<Omit<Tables[TableName], "id">>]: boolean } };

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
 * The adapter provides services for the handler.
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
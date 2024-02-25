
/** Values accepted by SQLite */
export type SQLValue = boolean | number | string | BigInt | Buffer | null;

export type BaseRow = object;

/** 
 * Convert value to a compatible SQLite value.
 * @throws If the value cannot be converted.
 */
export function sqlValue(value: any): SQLValue {
    if (value == null) {
        return null;
    }
    switch (typeof value) {
        case "number":
        case "bigint":
        case "string":
        case "boolean":
            // Returned as-is
            return value;
        case "object":
            // Stringify
            return JSON.stringify(value);
        case "symbol":
        case "function":
        default:
            throw new Error(`Value of type ${typeof value} cannot not be used as it cannot be stored in SQLite`);
    }
}

/**
 * Represents a unique connection to a database engine, 
 * ensuring that all queries are executed sequentially.
 */
export interface SQLConnection {

    /**
     * Retrieves a list of items from the database.
     * @param query The SQL query to execute.
     * @param params The parameters to be used in the query.
     * @returns A promise that resolves to an array of rows.
     */
    all<Row extends BaseRow>(query: string, ...params: SQLValue[]): Promise<Row[]>;

    /**
     * Retrieves a single item from the database if it exists.
     * @param query The SQL query to execute.
     * @param params The parameters to be used in the query.
     * @returns A promise that resolves to the row if found, or null if not found.
     */
    get<Row extends BaseRow>(query: string, ...params: SQLValue[]): Promise<Row | null>;

    /**
     * Inserts an item into the database.
     * @param query The SQL query to execute.
     * @param params The parameters to be used in the query.
     * @returns A promise that resolves to the number of rows affected by the insert operation.
     */
    insert(query: string, ...params: SQLValue[]): Promise<number | null>;

    /**
     * Executes a general SQL query.
     * @param query The SQL query to execute.
     * @param params The parameters to be used in the query.
     * @returns A promise that resolves when the query has been executed successfully.
     */
    run(query: string, ...params: SQLValue[]): Promise<void>;

}

/**
 * Abstract class for a pool of SQL connections.
 */
export abstract class AbstractSQLRunner<C extends SQLConnection = SQLConnection> implements SQLConnection {

    constructor() { }

    //#region Reserved connections --------------------------------------------

    /** Get exclusive access to a connection */
    public abstract reserveConnection(): Promise<C>;

    /** Release access to a connection */
    public abstract releaseConnection(connection: C): Promise<void>;

    /** An utility function to get a reserved connection and execute the provided callback on this connection */
    public async withReservedConnection<T>(callback: (connection: SQLConnection) => Promise<T>): Promise<T> {
        const connection = await this.reserveConnection();
        let result: T;
        try {
            result = await callback(connection);
        } finally {
            await this.releaseConnection(connection);
        }
        return result;
    }

    /** Run the function in a transaction */
    public async withTransaction<T>(callback: (connection: SQLConnection) => Promise<T>): Promise<T> {
        return this.withReservedConnection(async (connection: SQLConnection) => {
            try {
                await connection.run("BEGIN;");
                const result = await callback(connection);
                await connection.run("COMMIT;");
                return result;
            } catch (e) {
                // Rollback the transaction and forward the error
                await connection.run("ROLLBACK;");
                throw e;
            }
        });
    }

    //#endregion

    //#region SQLConnection implementation ------------------------------------

    /** @inheritdoc */
    public all<Row extends BaseRow>(query: string, ...params: SQLValue[]): Promise<Row[]> {
        return this.withReservedConnection(connection => connection.all<Row>(query, ...params));
    }

    /** @inheritdoc */
    public get<Row extends BaseRow>(query: string, ...params: SQLValue[]): Promise<Row | null> {
        return this.withReservedConnection(connection => connection.get<Row>(query, ...params));
    }

    /** @inheritdoc */
    public insert(query: string, ...params: SQLValue[]): Promise<number | null> {
        return this.withReservedConnection(connection => connection.insert(query, ...params));
    }

    /** @inheritdoc */
    public run(query: string, ...params: SQLValue[]): Promise<void> {
        return this.withReservedConnection(connection => connection.run(query, ...params));
    }

    //#endregion

}




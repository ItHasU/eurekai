import { ForeignKeys, TablesDefinition } from "@dagda/shared/sql/types";
import { Client, Pool, PoolClient } from "pg";
import { AbstractSQLRunner, SQLConnection, SQLValue } from "../runner";

/**
 * A SQL connection for PostgreSQL.
 */
export class PGConnection implements SQLConnection {

    constructor(public readonly client: Client | PoolClient) { }

    /** @inheritdoc */
    public async all<Row extends Record<string, SQLValue>>(query: string, ...params: SQLValue[]): Promise<Row[]> {
        console.debug("pg.all()", query, params);
        const result = await this.client.query<Row>(query, params);
        return result.rows;
    }

    /** @inheritdoc */
    public async get<Row extends Record<string, SQLValue>>(query: string, ...params: SQLValue[]): Promise<Row | null> {
        console.debug("pg.get()", query, params);
        const result = await this.client.query<Row>(query, params);
        if (result.rowCount === 0) {
            // No item found, no problem
            return null;
        } else if (result.rowCount === 1) {
            // Item was found, return it
            return result.rows[0];
        } else {
            // Too many items
            throw new Error(`Expected 0 or 1 row, got ${result.rowCount} rows`);
        }
    }

    /** @inheritdoc */
    public async insert(query: string, ...params: SQLValue[]): Promise<number | null> {
        console.debug("pg.insert()", query, params);
        // First, perform the insert
        await this.client.query(query, params);

        // Then retrieve the id of the inserted row
        try {
            const result = await this.client.query<{ id: number }>("SELECT LASTVAL() AS id");
            if (result.rowCount !== 1) {
                return null; // Failed to get an id
            } else {
                return result.rows[0].id;
            }
        } catch (error) {
            // An error occurred while retrieving the id
            throw error;
        }
    }

    /** @inheritdoc */
    public async run(query: string, ...params: SQLValue[]): Promise<void> {
        console.debug("pg.run()", query, params);
        await this.client.query(query, params);
    }

}

/** PostgreSQL pool handler */
export class PGRunner<Tables extends TablesDefinition> extends AbstractSQLRunner<Tables, PGConnection> {

    protected readonly _pool: Pool;

    constructor(foreignKeys: ForeignKeys<Tables>, connectionString: string) {
        super(foreignKeys);
        this._pool = new Pool({ connectionString });
    }

    /** @inheritdoc */
    public async reserveConnection(): Promise<PGConnection> {
        const poolClient = await this._pool.connect();
        return new PGConnection(poolClient);
    }

    /** @inheritdoc */
    public releaseConnection(connection: PGConnection): Promise<void> {
        // Release the connection
        const poolClient: PoolClient = connection.client as PoolClient;
        if (poolClient["release"]) {
            poolClient.release();
        }
        return Promise.resolve();
    }

    /** @inheritdoc */
    protected override _getIDFieldType(): string {
        return "SERIAL";
    }

}
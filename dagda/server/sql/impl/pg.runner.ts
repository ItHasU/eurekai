import { Client, Pool, PoolClient } from "pg";
import { AbstractSQLRunner, BaseRow, SQLConnection, SQLValue } from "../runner";

/**
 * A SQL connection for PostgreSQL.
 */
export class PGConnection implements SQLConnection {

    constructor(public readonly client: Client | PoolClient) { }

    /** @inheritdoc */
    public async all<Row extends BaseRow>(query: string, ...params: SQLValue[]): Promise<Row[]> {
        try {
            const result = await this.client.query<Row>(query, params);
            return result.rows;
        } catch (error) {
            console.error("Failed pg.all()", query, params);
            console.error(error);
            throw error;
        }
    }

    /** @inheritdoc */
    public async get<Row extends BaseRow>(query: string, ...params: SQLValue[]): Promise<Row | null> {
        try {
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
        catch (error) {
            console.error("Failed pg.get()", query, params);
            console.error(error);
            throw error;
        }
    }

    /** @inheritdoc */
    public async insert(query: string, ...params: SQLValue[]): Promise<number | null> {
        try {
            // First, perform the insert
            await this.client.query(query, params);

            // Then retrieve the id of the inserted row
            const result = await this.client.query<{ id: number }>("SELECT LASTVAL() AS id");
            if (result.rowCount !== 1) {
                return null; // Failed to get an id
            } else {
                return result.rows[0].id;
            }
        } catch (error) {
            console.error("Failed pg.insert()", query, params);
            console.error(error);
            throw error;
        }
    }

    /** @inheritdoc */
    public async run(query: string, ...params: SQLValue[]): Promise<void> {
        try {
            await this.client.query(query, params);
        } catch (error) {
            console.error("Failed pg.run()", query, params);
            console.error(error);
            throw error;
        }
    }

}

/** PostgreSQL pool handler */
export class PGRunner extends AbstractSQLRunner<PGConnection> {

    protected readonly _pool: Pool;

    constructor(connectionString: string) {
        super();
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

}
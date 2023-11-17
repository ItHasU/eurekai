import { ForeignKeys, TablesDefinition } from "@dagda/shared/sql/types";
import { WorkerRequest, WorkerResponse } from "@dagda/shared/sql/worker";
import { Pool } from "@dagda/shared/tools/pool";
import { cpus } from "node:os";
import { Worker } from "node:worker_threads";

/** Values accepted by SQLite */
export type SQLValue = number | string | BigInt | Buffer | null;

/** A generic runner */
export interface SQLRunner {

    /** Get a list of items */
    all<Row>(query: string, ...params: SQLValue[]): Promise<Row[]>;

    /** Get one item if it exists */
    get<Row>(query: string, ...params: SQLValue[]): Promise<Row | null>;

    /** Insert an item in the database */
    insert(query: string, ...params: SQLValue[]): Promise<number>;

    /** General query */
    run(query: string, ...params: SQLValue[]): Promise<void>;

}

/** Implementation of a runner using a worker */
export class SQLWorker implements SQLRunner {

    protected _worker: Worker;

    constructor(filename: string) {
        this._worker = new Worker("./dagda/worker-db/dist/main.js", {
            argv: [filename]
        });
        this._worker.on("message", this._onResponse.bind(this));
        this._worker.on("error", this._onError.bind(this));
        this._worker.on("exit", this._onError.bind(this));
    }

    //#region Select ----------------------------------------------------------

    /** Get a list of items */
    public all<Row>(query: string, ...params: SQLValue[]): Promise<Row[]> {
        try {
            return this._call({ id: 0, method: "all", query, params });
        } catch (e) {
            // console.log(query, params);
            return Promise.reject(e);
        }
    }

    /** Get one item if it exists */
    public get<Row>(query: string, ...params: SQLValue[]): Promise<Row | null> {
        try {
            return this._call({ id: 0, method: "get", query, params });
        } catch (e) {
            // console.log(query, params);
            return Promise.reject(e);
        }
    }

    //#endregion

    //#region Insert ----------------------------------------------------------

    /** Insert an item in the database */
    public async insert(query: string, ...params: SQLValue[]): Promise<number> {
        try {
            await this.run(query, ...params);
            return (await this.get<{ id: number }>("SELECT last_insert_rowid() AS id"))?.id ?? -1;
        } catch (e) {
            return Promise.reject(e);
        }
    }

    /** General query */
    public run(query: string, ...params: SQLValue[]): Promise<void> {
        try {
            return this._call({ id: 0, method: "run", query, params: params });
        } catch (e) {
            // console.log(query, params);
            return Promise.reject(e);
        }
    }

    //#endregion

    //#region Worker call -----------------------------------------------------

    protected _nextRequestId: number = 0;
    protected _pendingRequests: Map<number, { resolve: (data?: any) => void, reject: (e: any) => void }> = new Map();

    protected _call<T = void>(request: WorkerRequest): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            request.id = this._nextRequestId++;
            try {
                this._worker.postMessage(request);
                this._pendingRequests.set(request.id, { resolve, reject });
            } catch (e) {
                reject(e);
            }
        });
    }

    protected _onResponse(response: WorkerResponse): void {
        const handler = this._pendingRequests.get(response.id);
        if (handler == null) {
            console.error(`Unexpected response for request ${response.id}`);
            return;
        } else {
            this._pendingRequests.delete(response.id);
            if (response.error) {
                handler.reject(response.error);
            } else {
                handler.resolve(response.data);
            }
        }
    }

    protected _onError(e: any): void {
        console.error("Error from the worker");
        console.error(e);
        for (const entry of this._pendingRequests.entries()) {
            entry[1].reject(e);
        }
        this._pendingRequests.clear();
    }

    //#endregion

}

/** Helper for SQLite database */
export class SQLiteHelper<Tables extends TablesDefinition> implements SQLRunner {

    protected _queue: Pool<SQLRunner>;

    constructor(filename: string, protected _foreignKeys: ForeignKeys<Tables>) {
        const workers: SQLWorker[] = [];
        for (const cpu of cpus()) {
            workers.push(new SQLWorker(filename));
        }
        this._queue = new Pool<SQLRunner>(workers);
    }

    public get foreignKeys(): ForeignKeys<Tables> { return this._foreignKeys; }

    //#region Table creation --------------------------------------------------

    public async initTable<TN extends keyof Tables, T extends Tables[TN] = Tables[TN]>(
        tableName: TN,
        fieldTypes: { [fields in keyof Required<Omit<T, "id">>]: string }): Promise<void> {
        const fieldTypesFull: { [fields in keyof Required<T>]: string } = {
            "id": "INTEGER PRIMARY KEY AUTOINCREMENT",
            ...fieldTypes
        } as { [fields in keyof Required<T>]: string };

        await this.withTransaction(async runner => {
            await this._createTableIfNeeded(runner, tableName, fieldTypesFull);
            for (const fieldName in fieldTypesFull) {
                try {
                    await this._createFieldIfNeeded(runner, tableName, fieldName as keyof Required<T>, fieldTypesFull[fieldName]);
                } catch (e) {
                    // We don't care if the request fails, there is no IF NOT EXISTS for column creation
                }
            }
        });
    }

    protected _createTableIfNeeded<TN extends keyof Tables, T extends Tables[TN] = Tables[TN]>(runner: SQLRunner, tableName: TN, fieldTypes: { [fields in keyof Required<T>]: string }): Promise<void> {
        return runner.run(`CREATE TABLE IF NOT EXISTS ${tableName as string} (${Object.entries(fieldTypes).map(([fieldName, fieldType]) => `'${fieldName}' ${fieldType}`).join(", ")})`);
    }

    /** @returns true if column was created */
    protected _createFieldIfNeeded<TN extends keyof Tables, T extends Tables[TN] = Tables[TN]>(runner: SQLRunner, tableName: TN, fieldName: keyof Required<T>, fieldType: string): Promise<boolean> {
        return runner.run(`ALTER TABLE ${tableName as string} ADD COLUMN ${fieldName as string} ${fieldType}`).catch(() => false).then(() => true);
    }

    //#endregion

    //#region Transaction -----------------------------------------------------

    public withRunner<T>(f: (runner: SQLRunner) => Promise<T>): Promise<T> {
        return this._queue.run(f);
    }

    public async withTransaction<T>(f: (runner: SQLRunner) => Promise<T>): Promise<T> {
        return this.withRunner(async runner => {
            try {
                await runner.run("BEGIN");
                const result = await f(runner);
                await runner.run("COMMIT");
                return result;
            } catch (e) {
                await runner.run("ROLLBACK");
                throw e;
            }
        });
    }

    //#endregion


    //#region Select ----------------------------------------------------------

    /** Get a list of items */
    public async all<Row>(query: string, ...params: SQLValue[]): Promise<Row[]> {
        return this.withRunner(runner => runner.all(query, ...params));
    }

    /** Get one item if it exists */
    public async get<Row>(query: string, ...params: SQLValue[]): Promise<Row | null> {
        return this.withRunner(runner => runner.get(query, ...params));
    }

    //#endregion

    //#region Insert ----------------------------------------------------------

    /** Insert an item in the database */
    public async insert(query: string, ...params: SQLValue[]): Promise<number> {
        return this.withRunner(runner => runner.insert(query, ...params));
    }

    /** General query */
    public async run(query: string, ...params: SQLValue[]): Promise<void> {
        return this.withRunner(runner => runner.run(query, ...params));
    }

    //#endregion
}

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
            // Returned as-is
            return value;
        case "object":
            // Stringify
            return JSON.stringify(value);
        case "boolean":
        case "symbol":
        case "function":
        default:
            throw new Error(`Value of type ${typeof value} cannot not be used as it cannot be stored in SQLite`);
    }
}
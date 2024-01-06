import { EntitiesModel, FieldDefinitions, TypeDefinitions } from "@dagda/shared/entities/model";
import { WorkerRequest, WorkerResponse } from "@dagda/shared/sql/worker";
import { Worker } from "node:worker_threads";
import { AbstractSQLRunner, BaseRow, SQLConnection, SQLValue } from "../runner";


/** Implementation of a runner using a worker */
export class SQLiteConnection implements SQLConnection {

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
    public all<Row extends BaseRow>(query: string, ...params: SQLValue[]): Promise<Row[]> {
        try {
            return this._call({ id: 0, method: "all", query, params });
        } catch (e) {
            // console.log(query, params);
            return Promise.reject(e);
        }
    }

    /** Get one item if it exists */
    public get<Row extends BaseRow>(query: string, ...params: SQLValue[]): Promise<Row | null> {
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

    public async terminate(): Promise<void> {
        try {
            await this._worker.terminate();
        } catch (e) {
            // Ignore error
        }
    }

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
        console.debug("Error from the worker");
        console.debug(e);
        for (const entry of this._pendingRequests.entries()) {
            entry[1].reject(e);
        }
        this._pendingRequests.clear();
    }

    //#endregion

}

/** Helper for SQLite database */
export class SQLiteRunner<Types extends TypeDefinitions, Tables extends FieldDefinitions<Types, Tables>> extends AbstractSQLRunner<Types, Tables, SQLiteConnection> {

    constructor(modelProvider: () => EntitiesModel<Types, Tables>, protected _filename: string) {
        super(modelProvider);
    }

    //#region Implementation of AbstractSQLRunner -----------------------------

    /** @inheritdoc */
    public override reserveConnection(): Promise<SQLiteConnection> {
        const connection = new SQLiteConnection(this._filename);
        return Promise.resolve(connection);
    }

    /** @inheritdoc */
    public override releaseConnection(connection: SQLiteConnection): Promise<void> {
        // Release the connection
        return connection.terminate();
    }

    //#endregion

}

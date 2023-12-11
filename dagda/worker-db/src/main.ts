import { WorkerRequest, WorkerResponse } from "@dagda/shared/sql/worker";
import sqlite from "better-sqlite3";
import { MessagePort, parentPort } from "node:worker_threads";

class DatabaseWrapper {
    protected _db: sqlite.Database;

    constructor(protected _filename: string, protected _parentPort: MessagePort) {
        console.debug("Opening", _filename)
        this._db = new sqlite(_filename, {
            fileMustExist: false
        });

        this._parentPort.on("message", this._onMessage.bind(this));
    }

    protected _onMessage(request: WorkerRequest): void {
        // console.debug(request);
        const response: WorkerResponse = {
            id: request.id,
            data: undefined
        };
        try {
            const statement = this._db.prepare<unknown[]>(request.query);
            switch (request.method) {
                case "get":
                    response.data = statement.get(...request.params);
                    break;
                case "all":
                    response.data = statement.all(...request.params);
                    break;
                case "run":
                    response.data = statement.run(...request.params);
                    break;
            }
        } catch (e) {
            // console.debug(e);
            response.data = undefined;
            response.error = String(e);
        }
        this._parentPort.postMessage(response);
    }

}

// -- Main --------------------------------------------------------------------

if (parentPort == null) {
    throw "Invalid state. Must be run as a worker";
}
if (process.argv.length < 1) {
    throw `Invalid call, number of arguments must be 1 instead of ${process.argv.length} ${process.argv.join(" ")}`;
}

const filename = process.argv[process.argv.length - 1];
new DatabaseWrapper(filename, parentPort);

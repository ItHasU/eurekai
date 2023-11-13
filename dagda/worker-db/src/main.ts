import sqlite from "better-sqlite3";
import { MessagePort, parentPort } from "node:worker_threads";

class DatabaseWrapper {
    protected _db: sqlite.Database;

    constructor(protected _filename: string, protected _parentPort: MessagePort) {
        this._db = new sqlite(_filename, {
            fileMustExist: false
        });

        this._parentPort.on("message", this._onMessage.bind(this));
    }

    protected _onMessage(data: any): void {
        console.log(data);
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

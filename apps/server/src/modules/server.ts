import { registerAPI_SQLConnectorProxy } from "@dagda/server/sql/proxy.connector";
import { SQLiteConnector } from "@dagda/server/sql/sqlite.connector";
import { Tables } from "@eurekai/shared/src/types";
import express from "express";
import { resolve } from "node:path";
import { registerFetchAPI } from "./fetch";

export class AppServer {
    public readonly app: express.Express;

    constructor(options: {
        connector: SQLiteConnector<Tables>,
        port: number
    }) {
        // -- Create app --
        this.app = express();
        this.app.use(express.json());

        // -- Register routes --
        // Static files
        const path: string = resolve("./apps/client/dist");
        this.app.use(express.static(path));
        // SQL Connector
        registerAPI_SQLConnectorProxy(this.app, options.connector);
        registerFetchAPI(this.app, options.connector);

        // -- Listen --
        this.app.listen(options.port);
        console.log(`Server started, connect to http://localhost:${options.port}/`);
    }

}

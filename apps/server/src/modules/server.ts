import { registerAPI_SQLConnectorProxy } from "@dagda/sql-proxy-server/src/index";
import { SQLConnector } from "@dagda/sql-shared/src/sql.types";
import { Tables } from "@eurekai/shared/src/types";
import express from "express";
import { resolve } from "node:path";

export class AppServer {
    public readonly app: express.Express;

    constructor(options: {
        connector: SQLConnector<Tables>,
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

        // -- Listen --
        this.app.listen(options.port);
        console.log(`Server started, connect to http://localhost:${options.port}/`);
    }

}

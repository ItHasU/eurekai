import express from "express";
import { resolve } from "node:path";
import { buildRoutes } from "./routes";
import { DatabaseWrapper } from "./db";
import { registerAPI_SQLConnectorProxy } from "@dagda/sql-proxy-server/src/index"
import { Tables } from "@eurekai/shared/src/types";
import { SQLConnector } from "@dagda/sql-shared/src/sql.types";

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
        registerAPI_SQLConnectorProxy(this.app, null as any);

        // -- Listen --
        this.app.listen(options.port);
        console.log(`Server started, connect to http://localhost:${options.port}/`);
    }

}

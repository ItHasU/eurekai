import express from "express";
import { resolve } from "node:path";
import { buildRoutes } from "./routes";
import { DatabaseWrapper } from "./db";

export class AppServer {
    public readonly app: express.Express;

    constructor(options: {
        data: DatabaseWrapper,
        port: number
    }) {
        // -- Create app --
        this.app = express();
        this.app.use(express.json());

        // -- Register routes --
        // Static files
        const path: string = resolve("./apps/client/dist");
        this.app.use(express.static(path));
        // API
        this.app.use("/api", buildRoutes(options.data));
        // -- Listen --
        this.app.listen(options.port);
        console.log(`Server started, connect to http://localhost:${options.port}/`);
    }

}

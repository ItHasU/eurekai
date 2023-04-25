import express from "express";
import PouchDB from "pouchdb";
import { resolve } from "node:path";

export class AppServer {
    public readonly app: express.Express;
    public readonly dbConstructor: ReturnType<PouchDB.Static["defaults"]>;

    constructor(options: {
        port: number
    }) {
        // -- Create app --
        this.app = express();

        // -- Register routes --
        // Static files
        const path: string = resolve("./apps/client/dist");
        this.app.use(express.static(path));
        // Database
        this.dbConstructor = PouchDB.defaults({
            prefix: "db/"
        });
        this.app.use('/db', require('express-pouchdb')(this.dbConstructor));

        // -- Listen --
        this.app.listen(options.port);
        console.log(`Server started, connect to http://localhost:${options.port}/`);
    }

}

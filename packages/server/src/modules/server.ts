import express from "express";
import PouchDB from "pouchdb";
import { join } from "node:path";

export function init(options: {
    port: number;
}): express.Express {
    // -- Create app --
    const app = express();
    // -- Register routes --
    const path: string = join(__dirname, "../../client/dist");
    console.log(`Serving ${path}`);
    app.use(express.static(path));
    app.use('/db', require('express-pouchdb')(PouchDB));

    // -- Listen --
    app.listen(options.port)
    console.log(`Server started, connect to http://localhost:${options.port}/`);

    return app;
}


// app.listen(3000);
// }
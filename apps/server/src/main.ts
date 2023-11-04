import { submit } from "@dagda/server/sql/sqlite.adapter";
import { SQLHandler } from "@dagda/shared/sql/handler";
import { Filters, Tables, filterEquals } from "@eurekai/shared/src/types";
import { DiffusersRegistry } from "./diffusers";
import { getEnvNumber } from "./modules/config";
import { initDatabaseHelper } from "./modules/db";
import { Generator } from "./modules/generator";
import { initHTTPServer, sqlFetch } from "./modules/server";

async function main(): Promise<void> {
    // -- Initialize db -------------------------------------------------------
    const db = await initDatabaseHelper("./eurekai.db");
    const handler = new SQLHandler<Tables, Filters>({
        filterEquals: filterEquals,
        fetch: filter => sqlFetch(db, filter),
        submit: transactionData => submit(db, transactionData)
    });

    // -- Initialize the models -----------------------------------------------
    await DiffusersRegistry.fetchAllModels();
    const models = DiffusersRegistry.getModels();
    console.log(`${models.length} model(s)`);
    for (const model of models) {
        const info = model.getModelInfo();
        console.log(`- [${info.uid}] ${info.displayName}`);
    }

    // -- Generate ------------------------------------------------------------
    new Generator(handler);

    // -- Initialize HTTP server ----------------------------------------------
    const port = getEnvNumber("PORT");
    await initHTTPServer(db, port);

    console.log(`Server started, connect to http://localhost:${port}/`);
}

main().catch(e => console.error(e));
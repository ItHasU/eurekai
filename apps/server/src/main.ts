import { submit } from "@dagda/server/sql/sqlite.adapter";
import { SQLHandler } from "@dagda/shared/sql/handler";
import { AppContexts, AppTables, appContextEquals } from "@eurekai/shared/src/types";
import { DiffusersRegistry } from "./diffusers";
import { getEnvNumber } from "./modules/config";
import { initDatabaseHelper } from "./modules/db";
import { Generator } from "./modules/generator";
import { initHTTPServer, sqlFetch } from "./modules/server";

async function main(): Promise<void> {
    // -- Initialize db -------------------------------------------------------
    const db = await initDatabaseHelper("./eurekai.db");
    const handler = new SQLHandler<AppTables, AppContexts>({
        contextEquals: appContextEquals,
        fetch: filter => sqlFetch(db, filter),
        submit: transactionData => submit(db, transactionData)
    });

    // -- Initialize the models -----------------------------------------------
    try {
        await DiffusersRegistry.fetchAllModels();
        const models = DiffusersRegistry.getModels();
        console.log(`${models.length} model(s)`);
        for (const model of models) {
            const info = model.getModelInfo();
            console.log(`- [${info.uid}] ${info.displayName}`);
        }
    } catch (e) {
        console.error("Failed to fetch models, retry later manually");
    }

    // -- Generate ------------------------------------------------------------
    new Generator(handler);

    // -- Initialize HTTP server ----------------------------------------------
    const port = getEnvNumber("PORT");
    await initHTTPServer(db, port);

    console.log(`Server started, connect to http://localhost:${port}/`);
}

main().catch(e => console.error(e));
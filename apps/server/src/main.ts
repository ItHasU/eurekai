import { submit } from "@dagda/server/sql/sql.adapter";
import { getEnvNumber } from "@dagda/server/tools/config";
import { EntitiesHandler } from "@dagda/shared/entities/handler";
import { APP_MODEL, AppContexts, AppTables, appContextEquals } from "@eurekai/shared/src/entities";
import { DiffusersRegistry } from "./diffusers";
import { ENV_VARIABLES_NUMBER } from "./modules/config";
import { initDatabaseHelper } from "./modules/db";
import { Generator } from "./modules/generator";
import { initHTTPServer, sqlFetch } from "./modules/server";

async function main(): Promise<void> {
    // -- Initialize db -------------------------------------------------------
    const db = await initDatabaseHelper();
    const handler = new EntitiesHandler<AppTables, AppContexts>(APP_MODEL, {
        contextEquals: appContextEquals,
        contextIntersects: appContextEquals,
        fetch: filter => sqlFetch(db, filter),
        submit: transactionData => submit(db, transactionData)
    });

    // -- Initialize the models -----------------------------------------------
    try {
        await DiffusersRegistry.fetchAllModels();
    } catch (e) {
        console.error("Failed to fetch models, retry later manually");
    }

    const models = DiffusersRegistry.getModels();
    console.log(`${models.length} model(s)`);
    for (const model of models) {
        const info = model.getModelInfo();
        console.log(`- [${info.uid}] ${info.displayName}`);
    }

    // -- Generate ------------------------------------------------------------
    new Generator(handler);

    // -- Initialize HTTP server ----------------------------------------------
    const port = getEnvNumber<ENV_VARIABLES_NUMBER>("PORT");
    await initHTTPServer(db, port);

    console.log(`Server started, connect to http://localhost:${port}/`);
}

main().catch(e => console.error(e));
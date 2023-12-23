import { submit } from "@dagda/server/sql/sqlite.adapter";
import { getEnvNumber, getEnvString } from "@dagda/server/tools/config";
import { SQLHandler } from "@dagda/shared/sql/handler";
import { APP_FOREIGN_KEYS, AppContexts, AppTables, appContextEquals } from "@eurekai/shared/src/types";
import { DiffusersRegistry } from "./diffusers";
import { ReplicateSDXL } from "./diffusers/impl/replicateSDXL";
import { ENV_VARIABLES_NUMBER } from "./modules/config";
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
    }, APP_FOREIGN_KEYS);

    // -- Initialize the models -----------------------------------------------
    try {
        await DiffusersRegistry.fetchAllModels();
    } catch (e) {
        console.error("Failed to fetch models, retry later manually");
    }

    try {
        const REPLICATE_API_TOKEN = getEnvString("REPLICATE_TOKEN");
        DiffusersRegistry.push(new ReplicateSDXL(REPLICATE_API_TOKEN))
    } catch (e) {
        console.error("Failed to initialize replicate client");
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
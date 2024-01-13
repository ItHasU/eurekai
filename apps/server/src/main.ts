import { getEnvNumber } from "@dagda/server/tools/config";
import { DiffusersRegistry } from "./diffusers";
import { ENV_VARIABLES_NUMBER } from "./modules/config";
import { initDatabaseHelper } from "./modules/db";
import { Generator } from "./modules/generator";
import { initHTTPServer } from "./modules/server";

async function main(): Promise<void> {
    // -- Initialize db -------------------------------------------------------
    const db = await initDatabaseHelper();

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
    new Generator(db);

    // -- Initialize HTTP server ----------------------------------------------
    const port = getEnvNumber<ENV_VARIABLES_NUMBER>("PORT");
    await initHTTPServer(db, port);

    console.log(`Server started, connect to http://localhost:${port}/`);
}

main().catch(e => console.error(e));
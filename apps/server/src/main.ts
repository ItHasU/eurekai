import { getEnvNumber, getEnvString } from "./modules/config";
import { DatabaseWrapper } from "./modules/db";
import { registerAllModels } from "./modules/diffusers/impl/automatic1111.tools";
import { Generator } from "./modules/generator";
import { AppServer } from "./modules/server";

async function main(): Promise<void> {
    const apiURL = getEnvString("API_URL");

    const db = new DatabaseWrapper("eurekai.db");
    await registerAllModels(db, apiURL);

    await db.initIfNeeded();
    await db.fixComputingAtStart();

    new AppServer({
        data: db,
        port: getEnvNumber("PORT")
    });

    // Start the generator
    new Generator(db);
}

main().catch(e => console.error(e));
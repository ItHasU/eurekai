import { getEnvNumber, getEnvString } from "./modules/config";
import { DatabaseWrapper } from "./modules/db";
import { Generator } from "./modules/generator";
import { AppServer } from "./modules/server";

async function main(): Promise<void> {
    const apiURL = getEnvString("API_URL");

    const db = new DatabaseWrapper(apiURL, "eurekai.db");
    await db.initIfNeeded();

    new AppServer({
        data: db,
        port: getEnvNumber("PORT")
    });

    // Start the generator
    new Generator(db, apiURL);
}

main().catch(e => console.error(e));

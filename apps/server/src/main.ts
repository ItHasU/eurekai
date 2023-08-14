import { Automatic1111 } from "./modules/api";
import { Fooocus } from "./modules/api";
import { getEnvNumber, getEnvString } from "./modules/config";
import { DatabaseWrapper } from "./modules/db";
import { Generator } from "./modules/generator";
import { AppServer } from "./modules/server";

async function main(): Promise<void> {
    const apiURL = getEnvString("API_URL");
    //const api = new Automatic1111(apiURL);
    const api = new Fooocus(apiURL);

    const db = new DatabaseWrapper("eurekai.db", api);
    await db.initIfNeeded();
    await db.fixComputingAtStart();

    new AppServer({
        data: db,
        port: getEnvNumber("PORT")
    });

    // Start the generator
    new Generator(db, api);
}

main().catch(e => console.error(e));
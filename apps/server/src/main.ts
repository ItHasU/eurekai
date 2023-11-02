import { getEnvNumber, getEnvString } from "./modules/config";
import { initDatabaseHelper } from "./modules/db";
import { initHTTPServer } from "./modules/server";

async function main(): Promise<void> {
    const apiURL = getEnvString("API_URL");

    // -- Initialize db -------------------------------------------------------
    const db = await initDatabaseHelper("./eurekai.db");

    // -- Initialize HTTP server ----------------------------------------------
    const port = getEnvNumber("PORT");
    await initHTTPServer(db, port);

    console.log(`Server started, connect to http://localhost:${port}/`);
}

main().catch(e => console.error(e));
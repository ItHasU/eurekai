import { getEnvNumber, getEnvString } from "./modules/config";
import { DatabaseWrapper } from "./modules/db";
import { Generator } from "./modules/generator";
import { AppServer } from "./modules/server";

async function main(): Promise<void> {
    const db = new DatabaseWrapper("eurekai.db");
    await db.initIfNeeded();

    new AppServer({
        data: db,
        port: getEnvNumber("PORT")
    });

    // Start the generator
    new Generator(db, getEnvString("API_URL"));
}

main().catch(e => console.error(e));

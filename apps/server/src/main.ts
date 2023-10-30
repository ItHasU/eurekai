import { APP_FOREIGN_KEYS, Tables } from "@eurekai/shared/src/types";
import { getEnvNumber, getEnvString } from "./modules/config";
import { DatabaseWrapper } from "./modules/db";
import { registerAllModels } from "./modules/diffusers/impl/automatic1111.tools";
import { Generator } from "./modules/generator";
import { AppServer } from "./modules/server";
import {SQLiteConnector } from "@dagda/sql-sqlite/src/sqlite.connector";

async function main(): Promise<void> {
    const apiURL = getEnvString("API_URL");

    const connector = new SQLiteConnector<Tables>(APP_FOREIGN_KEYS, "./test.db");

    new AppServer({
        connector,
        port: getEnvNumber("PORT")
    });

    // Start the generator
    new Generator(db);
}

main().catch(e => console.error(e));
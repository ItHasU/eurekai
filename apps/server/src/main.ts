import { SQLiteConnector } from "@dagda/server/sql/sqlite.connector";
import { APP_FOREIGN_KEYS, Tables } from "@eurekai/shared/src/types";
import { getEnvNumber, getEnvString } from "./modules/config";
import { AppServer } from "./modules/server";

async function main(): Promise<void> {
    const apiURL = getEnvString("API_URL");

    const connector = new SQLiteConnector<Tables>(APP_FOREIGN_KEYS, "./eurekai.db");
    connector.initTable("projects", {
        "name": "TEXT",
        "featuredAttachmentId": "INTEGER NULL",
        "lockable": "INTEGER DEFAULT FALSE", // FALSE = 0
        "pinned": "INTEGER DEFAULT FALSE"    // FALSE = 0
    });

    new AppServer({
        connector,
        port: getEnvNumber("PORT")
    });
}

main().catch(e => console.error(e));
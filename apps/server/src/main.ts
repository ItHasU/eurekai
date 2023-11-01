import { SQLiteConnector } from "@dagda/server/sql/sqlite.connector";
import { APP_FOREIGN_KEYS, Tables } from "@eurekai/shared/src/types";
import { getEnvNumber, getEnvString } from "./modules/config";
import { AppServer } from "./modules/server";

async function main(): Promise<void> {
    const apiURL = getEnvString("API_URL");

    const connector = new SQLiteConnector<Tables>("./eurekai.db", APP_FOREIGN_KEYS);
    await connector.initTable("projects", {
        "name": "TEXT",
        "featuredAttachmentId": "INTEGER NULL",
        "lockable": "INTEGER DEFAULT FALSE", // FALSE = 0
        "pinned": "INTEGER DEFAULT FALSE"    // FALSE = 0
    });
    await connector.initTable("prompts", {
        "projectId": "INTEGER",
        "orderIndex": "INTEGER",
        "active": "INTEGER",
        "bufferSize": "INTEGER",
        "width": "INTEGER",
        "height": "INTEGER",
        "model": "TEXT",
        "prompt": "TEXT",
        "negative_prompt": "TEXT"
    });

    new AppServer({
        connector,
        port: getEnvNumber("PORT")
    });
}

main().catch(e => console.error(e));
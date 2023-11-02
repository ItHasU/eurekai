import { SQLiteHelper } from "@dagda/server/sql/sqlite.helper";
import { APP_FOREIGN_KEYS, Tables } from "@eurekai/shared/src/types";

/** Build a SqliteHelper and initialize tables if needed */
export async function initDatabaseHelper(filename: string): Promise<SQLiteHelper<Tables>> {
    const helper = new SQLiteHelper<Tables>(filename, APP_FOREIGN_KEYS);

    // -- Initialize tables ---------------------------------------------------
    await helper.initTable("projects", {
        "name": "TEXT",
        "featuredAttachmentId": "INTEGER NULL",
        "lockable": "INTEGER DEFAULT FALSE", // FALSE = 0
        "pinned": "INTEGER DEFAULT FALSE"    // FALSE = 0
    });
    await helper.initTable("prompts", {
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

    return helper;
}
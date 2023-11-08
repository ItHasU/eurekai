import { SQLiteHelper } from "@dagda/server/sql/sqlite.helper";
import { APP_FOREIGN_KEYS, AppTables } from "@eurekai/shared/src/types";

/** Build a SqliteHelper and initialize tables if needed */
export async function initDatabaseHelper(filename: string): Promise<SQLiteHelper<AppTables>> {
    const helper = new SQLiteHelper<AppTables>(filename, APP_FOREIGN_KEYS);

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
        "width": "INTEGER",
        "height": "INTEGER",
        "model": "TEXT",
        "prompt": "TEXT",
        "negative_prompt": "TEXT"
    });
    await helper.initTable("pictures", {
        promptId: "INTEGER",
        seed: "INTEGER",
        status: "INTEGER",
        attachmentId: "INTEGER NULL",
        highresStatus: "INTEGER",
        highresAttachmentId: "INTEGER NULL"
    });
    await helper.initTable("attachments", {
        data: "TEXT"
    });
    await helper.initTable("seeds", {
        projectId: "INTEGER",
        seed: "INTEGER"
    });

    return helper;
}
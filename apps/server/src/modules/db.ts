import { PGRunner } from "@dagda/server/sql/impl/pg.runner";
import { getEnvString } from "@dagda/server/tools/config";
import { APP_FOREIGN_KEYS, AppTables } from "@eurekai/shared/src/types";
import { ENV_VARIABLES_STR } from "./config";

/** Build a SqliteHelper and initialize tables if needed */
export async function initDatabaseHelper(filename: string): Promise<PGRunner<AppTables>> {
    const runner = new PGRunner<AppTables>(APP_FOREIGN_KEYS, getEnvString<ENV_VARIABLES_STR>("DATABASE_URL"));

    // -- Initialize tables ---------------------------------------------------
    await runner.initTable("projects", {
        "name": "TEXT",
        "featuredAttachmentId": "INTEGER NULL",
        "lockable": "BOOLEAN DEFAULT FALSE", // FALSE = 0
        "pinned": "BOOLEAN DEFAULT FALSE"    // FALSE = 0
    });
    await runner.initTable("prompts", {
        "projectId": "INTEGER",
        "orderIndex": "INTEGER",
        "width": "INTEGER",
        "height": "INTEGER",
        "model": "TEXT",
        "prompt": "TEXT",
        "negative_prompt": "TEXT"
    });
    await runner.initTable("pictures", {
        promptId: "INTEGER",
        seed: "INTEGER",
        status: "INTEGER",
        attachmentId: "INTEGER NULL",
        highresStatus: "INTEGER",
        highresAttachmentId: "INTEGER NULL"
    });
    await runner.initTable("attachments", {
        data: "TEXT"
    });
    await runner.initTable("seeds", {
        projectId: "INTEGER",
        seed: "INTEGER"
    });

    return runner;
}
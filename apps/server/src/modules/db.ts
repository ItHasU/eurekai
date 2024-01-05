import { PGRunner } from "@dagda/server/sql/impl/pg.runner";
import { getEnvString } from "@dagda/server/tools/config";
import * as pg from "pg";
import { ENV_VARIABLES_STR } from "./config";

/** Build a SqliteHelper and initialize tables if needed */
export async function initDatabaseHelper(filename: string): Promise<PGRunner> {
    pg.types.setTypeParser(20 /* BIGINT */, parseInt);

    const runner = new PGRunner(getEnvString<ENV_VARIABLES_STR>("DATABASE_URL"));

    // -- Initialize tables --
    // FIXME: Use TypeHandler to get the scripts to execute

    return runner;
}
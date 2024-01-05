import { PGRunner } from "@dagda/server/sql/impl/pg.runner";
import { getEnvString } from "@dagda/server/tools/config";
import { APP_MODEL } from "@eurekai/shared/src/entities";
import * as pg from "pg";
import { ENV_VARIABLES_STR } from "./config";

/** Build a SqliteRunner and initialize tables if needed */
export async function initDatabaseHelper(): Promise<PGRunner<any, any>> {
    pg.types.setTypeParser(20 /* BIGINT */, parseInt);

    const runner = new PGRunner(() => APP_MODEL, getEnvString<ENV_VARIABLES_STR>("DATABASE_URL"));

    // -- Initialize tables --
    // FIXME: Use TypeHandler to get the scripts to execute

    return runner;
}
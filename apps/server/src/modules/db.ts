import { PGRunner } from "@dagda/server/sql/impl/pg.runner";
import { getEnvString } from "@dagda/server/tools/config";
import { AppTables } from "@eurekai/shared/src/entities";
import * as pg from "pg";
import { ENV_VARIABLES_STR } from "./config";

/** Build a SqliteRunner and initialize tables if needed */
export async function initDatabaseHelper(): Promise<PGRunner> {
    pg.types.setTypeParser(20 /* BIGINT */, parseInt);

    const runner = new PGRunner(getEnvString<ENV_VARIABLES_STR>("DATABASE_URL"));

    // -- Initialize tables --
    // FIXME: Use TypeHandler to get the scripts to execute

    return runner;
}


/** Quoted table name */
export function qt(table: keyof AppTables): string {
    return `"${table as string}"`;
}

/** Quoted field from a table */
export function qf<Table extends keyof AppTables>(table: Table, field: keyof AppTables[Table], withTable: boolean = true): string {
    return (withTable ? `"${table as string}".` : "") + `"${field as string}"`;
}
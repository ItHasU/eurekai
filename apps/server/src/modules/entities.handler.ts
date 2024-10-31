import { AbstractSQLRunner } from "@dagda/server/sql/runner";
import { generateSubmit } from "@dagda/server/sql/sql.adapter";
import { EntitiesHandler } from "@dagda/shared/entities/handler";
import { APP_MODEL, AppContexts, AppTables, appContextEquals } from "@eurekai/shared/src/entities";
import { sqlFetch } from "./server";

export function buildServerEntitiesHandler(db: AbstractSQLRunner) {
    const handler = new EntitiesHandler<AppTables, AppContexts>(APP_MODEL, {
        contextEquals: appContextEquals,
        contextIntersects: appContextEquals,
        fetch: sqlFetch.bind(null, db),
        submit: generateSubmit(db, APP_MODEL)
    });
    return handler
}

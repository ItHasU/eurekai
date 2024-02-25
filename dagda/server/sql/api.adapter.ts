import { EntitiesModel } from "@dagda/shared/entities/model";
import { Data, TablesDefinition } from "@dagda/shared/entities/types";
import { SQLAdapterAPI, SQL_URL } from "@dagda/shared/sql/api";
import { Application } from "express";
import { registerAPI } from "../api";
import { AbstractSQLRunner, SQLConnection } from "./runner";
import { generateSubmit } from "./sql.adapter";

/** 
 * Register SQLAdapter API on the server.
 * You only need to provide the fetch function as submit is generic.
 */
export function registerAdapterAPI<Tables extends TablesDefinition, Contexts>(
    app: Application,
    model: EntitiesModel<any, any>,
    runner: AbstractSQLRunner<SQLConnection>,
    fetch: (helper: AbstractSQLRunner<SQLConnection>, filter: Contexts) => Promise<Data<Tables>>
): void {
    registerAPI<SQLAdapterAPI<Tables, Contexts>>(app, SQL_URL, {
        submit: generateSubmit(runner, model),
        fetch: fetch.bind(null, runner)
    });
}
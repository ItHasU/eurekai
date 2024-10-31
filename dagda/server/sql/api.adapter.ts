import { EntitiesModel } from "@dagda/shared/entities/model";
import { Data, TablesDefinition } from "@dagda/shared/entities/types";
import { SQL_URL } from "@dagda/shared/sql/api";
import { SQLTransactionData } from "@dagda/shared/sql/transaction";
import { Application } from "express";
import { registerAPI, RequestHandle } from "../api";
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
    const fSubmit = generateSubmit(runner, model);
    registerAPI(app, SQL_URL, {
        submit: function (h: RequestHandle, transactionData: SQLTransactionData<Tables, Contexts>) {
            return fSubmit(transactionData);
        },
        fetch: function (h: RequestHandle, filter: Contexts) {
            return fetch(runner, filter);
        }
    });
}
import { Data, TablesDefinition } from "@dagda/shared/entities/types";
import { SQLAdapterAPI, SQL_URL } from "@dagda/shared/sql/api";
import { SQLTransactionData } from "@dagda/shared/sql/transaction";
import { Application } from "express";
import { registerAPI } from "../api";
import { AbstractSQLRunner, SQLConnection } from "./runner";
import { submit } from "./sql.adapter";

/** 
 * Register SQLAdapter API on the server.
 * You only need to provide the fetch function as submit is generic.
 */
export function registerAdapterAPI<Tables extends TablesDefinition, Contexts>(
    app: Application,
    helper: AbstractSQLRunner<any, any, SQLConnection>,
    fetch: (helper: AbstractSQLRunner<any, any, SQLConnection>, filter: Contexts) => Promise<Data<Tables>>
): void {
    registerAPI<SQLAdapterAPI<Tables, Contexts>>(app, SQL_URL, {
        submit: (transactionData: SQLTransactionData<Tables, Contexts>) => submit<Tables, Contexts>(helper, transactionData),
        fetch: fetch.bind(null, helper)
    });
}
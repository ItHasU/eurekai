import { SQLAdapterAPI, SQL_URL } from "@dagda/shared/sql/api";
import { SQLTransactionData } from "@dagda/shared/sql/transaction";
import { Data, TablesDefinition } from "@dagda/shared/sql/types";
import { Application } from "express";
import { registerAPI } from "../api";
import { submit } from "./sqlite.adapter";
import { SQLiteHelper } from "./sqlite.helper";

/** 
 * Register SQLAdapter API on the server.
 * You only need to provide the fetch function as submit is generic.
 */
export function registerAdapterAPI<Tables extends TablesDefinition, Context>(
    app: Application,
    helper: SQLiteHelper<Tables>,
    fetch: (helper: SQLiteHelper<Tables>, filter: Context) => Promise<Data<Tables>>
): void {
    registerAPI<SQLAdapterAPI<Tables, Context>>(app, SQL_URL, {
        submit: (transactionData: SQLTransactionData<Tables>) => submit<Tables>(helper, transactionData),
        fetch: fetch.bind(null, helper)
    });
}
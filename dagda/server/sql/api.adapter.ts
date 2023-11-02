import { SQLAdapterAPI, SQL_URL } from "@dagda/shared/sql/api";
import { SQLTransactionData } from "@dagda/shared/sql/transaction";
import { Data, TablesDefinition } from "@dagda/shared/sql/types";
import { Application } from "express";
import { registerAPI } from "../api";
import { submit } from "./sqlite.adapter";
import { SQLiteHelper } from "./sqlite.helper";

export function registerAdapterAPI<Tables extends TablesDefinition, Filter>(app: Application, helper: SQLiteHelper<Tables>, fetch: (helper: SQLiteHelper<Tables>, filter: Filter) => Promise<Data<Tables>>): void {
    registerAPI<SQLAdapterAPI<Tables, Filter>>(app, SQL_URL, {
        submit: (transactionData: SQLTransactionData<Tables>) => submit<Tables>(helper, transactionData),
        fetch: fetch.bind(null, helper)
    });
}
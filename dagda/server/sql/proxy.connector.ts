import { SQLConnectorAPI, SQL_URL } from "@dagda/shared/sql/api";
import { SQLTransactionData } from "@dagda/shared/sql/transaction";
import { SQLConnector, TablesDefinition } from "@dagda/shared/sql/types";
import { Application } from "express";
import { registerAPI } from "../api";

export function registerAPI_SQLConnectorProxy<Tables extends TablesDefinition>(app: Application, connector: SQLConnector<Tables>): void {
    const api: SQLConnectorAPI<Tables> = {
        submit: (data: SQLTransactionData<Tables>) => {
            return connector.submit(data);
        }
    }
    registerAPI(app, SQL_URL, api);
}
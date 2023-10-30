import { SQLTransactionData } from "@dagda/sql-shared/src/sql.transaction";
import { SQLConnector, TablesDefinition } from "@dagda/sql-shared/src/sql.types";
import { SQLConnectorAPI, SQL_URL } from "@dagda/sql-proxy-shared/src";
import { Application } from "express";
import { registerAPI } from "@dagda/api-server/src";

export function registerAPI_SQLConnectorProxy<Tables extends TablesDefinition>(app: Application, connector: SQLConnector<Tables>): void {
    const api: SQLConnectorAPI<Tables> = {
        getItems: <TableName extends keyof Tables>(tableName: TableName) => {
            return connector.getItems(tableName);
        },
        submit: (data: SQLTransactionData<Tables>) => {
            return connector.submit(data);
        }
    }
    registerAPI(app, SQL_URL, api);
}
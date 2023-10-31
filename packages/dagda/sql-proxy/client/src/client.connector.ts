import { apiCall } from "@dagda/api-client/src";
import { SQLConnectorAPI, SQL_URL } from "@dagda/sql-proxy-shared/src";
import { SQLTransactionData } from "@dagda/sql-shared/src/sql.transaction";
import { SQLConnector, SQLTransactionResult, TablesDefinition } from "@dagda/sql-shared/src/sql.types";

export class SQLClientConnector<Tables extends TablesDefinition> extends SQLConnector<Tables> {

    /** @inheritdoc */
    public override getItems<TableName extends keyof Tables>(tableName: TableName): Promise<Tables[TableName][]> {
        return apiCall<SQLConnectorAPI<Tables>, "getItems">(SQL_URL, "getItems", tableName) as any;
    }
    
    /** @inheritdoc */
    public override submit(transactionData: SQLTransactionData<Tables>): Promise<SQLTransactionResult> {
        return apiCall<SQLConnectorAPI<Tables>, "submit">(SQL_URL, "submit", transactionData);
    }
}
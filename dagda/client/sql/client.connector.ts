import { apiCall } from "@dagda/client/api";
import { SQLConnectorAPI, SQL_URL } from "@dagda/shared/sql/api";
import { SQLTransactionData } from "@dagda/shared/sql/transaction";
import { SQLConnector, SQLTransactionResult, TablesDefinition } from "@dagda/shared/sql/types";

export class SQLClientConnector<Tables extends TablesDefinition> extends SQLConnector<Tables> {

    /** @inheritdoc */
    public override submit(transactionData: SQLTransactionData<Tables>): Promise<SQLTransactionResult> {
        return apiCall<SQLConnectorAPI<Tables>, "submit">(SQL_URL, "submit", transactionData);
    }
}
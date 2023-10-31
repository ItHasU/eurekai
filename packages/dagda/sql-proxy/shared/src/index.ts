import { SQLTransactionData } from "@dagda/sql-shared/src/sql.transaction";
import { SQLTransactionResult, TablesDefinition } from "@dagda/sql-shared/src/sql.types";

export const SQL_URL = "/sql";

export type SQLConnectorAPI<Tables extends TablesDefinition> = {
    getItems: <TableName extends keyof Tables>(tableName: TableName) => Promise<Tables[TableName][]>;
    submit: (transaction: SQLTransactionData<Tables>) => Promise<SQLTransactionResult>;
}

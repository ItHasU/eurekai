import { SQLTransactionData } from "./transaction";
import { SQLTransactionResult, TablesDefinition } from "./types";

export const SQL_URL = "/sql";

export type SQLConnectorAPI<Tables extends TablesDefinition> = {
    submit: (transaction: SQLTransactionData<Tables>) => Promise<SQLTransactionResult>;
}

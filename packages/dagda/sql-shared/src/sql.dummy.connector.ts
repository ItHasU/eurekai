import { OperationType, SQLTransaction } from "./sql.transaction";
import { SQLConnector, TablesDefinition, TransactionResult } from "./sql.types";

/** A fake SQL connector to test the app */
export class SQLDummyConnector<Tables extends TablesDefinition> implements SQLConnector<Tables>{

    protected _lastId: number = 0;

    constructor(private _data: { [TableName in keyof Tables]: Tables[TableName][] }) { }

    /** @inheritdoc */
    public getById<TableName extends keyof Tables>(tableName: TableName, id: number): Promise<Tables[TableName] | undefined> {
        const items = this._data[tableName];
        if (items == null) {
            return Promise.resolve(undefined);
        } else {
            for (const item of items) {
                if (item.id === id) {
                    return Promise.resolve(item);
                }
            }
            return Promise.resolve(undefined);
        }
    }

    public getItems<TableName extends keyof Tables>(tableName: TableName): Promise<Tables[TableName][]> {
        return Promise.resolve(this._data[tableName] ?? []);
    }

    public submit(transaction: SQLTransaction<Tables>): Promise<TransactionResult> {
        // Create new ids for inserted items
        const result: TransactionResult = {
            updatedIds: {}
        };
        for (const operation of transaction.operations) {
            switch(operation.type){
                case OperationType.INSERT:
                    const previousId = operation.options.item.id;
                    operation.options.item.id = ++this._lastId;
                    result.updatedIds[previousId] = operation.options.item.id;
                    break;
                default:
                    throw "Not implemented";
            }
        }

        return Promise.resolve(result);
    }
}
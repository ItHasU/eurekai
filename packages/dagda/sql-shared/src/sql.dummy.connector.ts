import { OperationType, SQLTransaction } from "./sql.transaction";
import { ForeignKeys, SQLConnector, TablesDefinition, TransactionResult } from "./sql.types";

/** A fake SQL connector to test the app */
export class SQLDummyConnector<Tables extends TablesDefinition> extends SQLConnector<Tables>{

    protected _lastId: number = 0;

    constructor(foreignKeys: ForeignKeys<Tables>, private _data: { [TableName in keyof Tables]: Tables[TableName][] }) {
        super(foreignKeys);
    }

    public serialize(): string {
        return JSON.stringify(this._data);
    }

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
            switch (operation.type) {
                case OperationType.INSERT: {
                    const previousId = operation.options.item.id;
                    operation.options.item.id = ++this._lastId;
                    console.log(`DB: insert(${operation.options.table as string}, ${previousId} => ${this._lastId})`);
                    this._data[operation.options.table].push({ ...operation.options.item });
                    result.updatedIds[previousId] = operation.options.item.id;
                    break;
                }
                case OperationType.UPDATE: {
                    const items = this._data[operation.options.table] ?? [];
                    for (const item of items) {
                        if (item.id === operation.options.id) {
                            for (const k in operation.options.values) {
                                const newValue = (operation.options.values as any)[k] ?? null;
                                console.log(`DB: update(${operation.options.table as string}, ${item.id}, ${k} = ${newValue})`);
                                const itemA = item as any;
                                itemA[k] = newValue;
                            }
                        }
                    }
                    break;
                }
                case OperationType.DELETE: {
                    console.log(`DB: delete(${operation.options.table as string}, ${operation.options.id})`);
                    const items = this._data[operation.options.table] ?? [];
                    this._data[operation.options.table] = items.filter(item => item.id !== operation.options.id);
                    break;
                }
                default:
                    throw "Not implemented";
            }
            console.log("DB:", this.serialize());
        }

        return Promise.resolve(result);
    }
}
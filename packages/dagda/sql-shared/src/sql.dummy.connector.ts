import { SQLConnector, TablesDefinition } from "./sql.types";

/** A fake SQL connector to test the app */
export class SQLDummyConnector<Tables extends TablesDefinition> implements SQLConnector<Tables>{

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

}
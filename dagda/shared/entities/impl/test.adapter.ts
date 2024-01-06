import { OperationType, SQLTransactionData } from "../../sql/transaction";
import { _updateForeignKeys } from "../handler";
import { EntitiesModel } from "../model";
import { Data, SQLAdapter, SQLTransactionResult, TablesDefinition } from "../types";

export type EntityContext<TableNames> = { table: TableNames, id?: number };


export class TestSQLAdapter<Tables extends TablesDefinition> implements SQLAdapter<Tables, EntityContext<keyof Tables>> {

    /** Last id generated */
    protected _lastId = 0;
    /** Memory storage of the entities */
    protected _repositories: { [TableName in keyof Tables]?: Tables[TableName][] } = {};

    constructor(protected _model: EntitiesModel<any, any>) { }

    public reset() {
        this._lastId = 0;
        this._repositories = {};
    }

    public contextEquals<TableNames extends string>(newContext: EntityContext<TableNames>, oldContext: EntityContext<TableNames>) {
        return newContext.table === oldContext.table && newContext.id === oldContext.id;
    }

    public contextIntersects<TableNames extends string>(newContext: EntityContext<TableNames>, oldContext: EntityContext<TableNames>) {
        return newContext.table === oldContext.table && (newContext.id === undefined || oldContext.id === undefined || newContext.id === oldContext.id);
    }

    public fetch(context: EntityContext<keyof Tables>): Promise<Data<Tables>> {
        const result: Data<Tables> = {};
        if (context.id == null) {
            // Return the full table
            result[context.table] = this._repositories[context.table];
        } else {
            // Return any item related to the given entity ...
            // ... either the item itself ...
            result[context.table] = this._repositories[context.table]?.filter(item => item.id === context.id);
            // ... or any item that references it.
            for (const tableName in this._repositories) {
                const existingEntities = this._repositories[tableName];
                if (!existingEntities?.length) {
                    // No items any way
                    continue;
                }
                const relatedItems: Set<any> = new Set(); // We use a set to avoid duplicates
                const foreignKeys = this._model.getTableForeignKeys(tableName);
                for (const foreignKey in foreignKeys) {
                    if (foreignKeys[foreignKey] === context.table) {
                        for (const entity of existingEntities) {
                            if ((entity as any)[foreignKey] === context.id) {
                                relatedItems.add(entity);
                            }
                        }
                    }
                }
                if (relatedItems.size) {
                    result[tableName] = Array.from(relatedItems);
                }
            }
        }
        return Promise.resolve(result);
    }

    public submit(transactionData: SQLTransactionData<Tables, EntityContext<keyof Tables>>): Promise<SQLTransactionResult> {
        const result: SQLTransactionResult = {
            updatedIds: {}
        };
        const foreignKeys = this._model.getForeignKeys() as any;
        for (const operation of transactionData.operations) {
            switch (operation.type) {
                case OperationType.INSERT:
                    _updateForeignKeys(foreignKeys, result, operation.options.table, operation.options.item);

                    // Clone the item and generate a new id
                    const entity = {
                        ...operation.options.item,
                        id: ++this._lastId
                    };
                    result.updatedIds[operation.options.item.id] = entity.id;
                    // Save the new item in the repository
                    const repository = this._repositories[operation.options.table] ?? [];
                    repository.push(entity);
                    this._repositories[operation.options.table] = repository;
                    break;
                case OperationType.UPDATE:
                    _updateForeignKeys<Tables, keyof Tables>(foreignKeys, result, operation.options.table, operation.options.values as any);

                    // Find the item in the repository
                    const repositoryToUpdate = this._repositories[operation.options.table];
                    if (!repositoryToUpdate) {
                        throw new Error(`Cannot update ${operation.options.table as string}.${operation.options.id} because the repository does not exists.`);
                    }
                    const itemToUpdate = repositoryToUpdate.find(item => item.id === operation.options.id);
                    if (!itemToUpdate) {
                        throw new Error(`Cannot update item ${operation.options.table as string}.${operation.options.id} because the entity is not found in the repository.`);
                    }
                    // Update the item
                    for (const field in operation.options.values) {
                        (itemToUpdate as any)[field] = operation.options.values[field];
                    }
                    break;
                case OperationType.DELETE:
                    // Find the item in the repository
                    const repositoryToDelete = this._repositories[operation.options.table];
                    if (!repositoryToDelete) {
                        throw new Error(`Cannot delete ${operation.options.table as string}.${operation.options.id} because the repository does not exists.`);
                    }
                    const itemToDelete = repositoryToDelete.find(item => item.id === operation.options.id);
                    if (!itemToDelete) {
                        throw new Error(`Cannot delete item ${operation.options.table as string}.${operation.options.id} because the entity is not found in the repository.`);
                    }
                    // Delete the item
                    const index = repositoryToDelete.indexOf(itemToDelete);
                    repositoryToDelete.splice(index, 1);
                    break;
            }
        }
        return Promise.resolve(result);
    }
}
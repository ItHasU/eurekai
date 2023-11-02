import { OperationType, SQLTransactionData, SQLTransactionResult } from "@dagda/shared/sql/transaction";
import { BaseDTO, ForeignKeys, TablesDefinition } from "@dagda/shared/sql/types";
import { SQLValue, SQLiteHelper, sqlValue } from "./sqlite.helper";

/** Transaction submit implementation for SQLite */
export async function submit<Tables extends TablesDefinition>(helper: SQLiteHelper<Tables>, transactionData: SQLTransactionData<Tables>): Promise<SQLTransactionResult> {
    const result: SQLTransactionResult = {
        updatedIds: {}
    }
    try {
        await helper.run("BEGIN");
        for (const operation of transactionData) {
            switch (operation.type) {
                case OperationType.INSERT: {
                    _updateForeignKeys(helper.foreignKeys, result, operation.options.table, operation.options.item);
                    const columnNames = [];
                    const values: SQLValue[] = [];
                    for (const key in operation.options.item) {
                        if (key === "id") {
                            // Autogenerated
                            continue;
                        }
                        columnNames.push(key);
                        values.push(sqlValue(operation.options.item[key]));
                    }
                    const query = `INSERT INTO ${operation.options.table as string} (${columnNames.join(",")}) VALUES (${columnNames.map(_ => "?").join(",")})`;
                    const newId = await helper.insert(query, values);
                    result.updatedIds[operation.options.item.id] = newId;
                    break;
                }
                case OperationType.UPDATE: {
                    _updateForeignKeys(helper.foreignKeys, result, operation.options.table, operation.options.values as any);
                    const columnNames = [];
                    const values: SQLValue[] = [];
                    for (const key in operation.options.values) {
                        if (key === "id") {
                            // Autogenerated, you cannot update it
                            continue;
                        }
                        columnNames.push(`"${key}"=?`);
                        values.push(sqlValue(operation.options.values[key]));
                    }
                    values.push(_getUpdatedId(result, operation.options.id));
                    const query = `UPDATE ${operation.options.table as string} SET ${columnNames.join(",")} WHERE id=?`;
                    await helper.run(query, values);
                    break;
                }
                case OperationType.DELETE: {
                    const query = `DELETE FROM ${operation.options.table as string} WHERE id=?`;
                    await helper.run(query, [_getUpdatedId(result, operation.options.id)]);
                    break;
                }
                default:
                    throw new Error("Not implemented");
            }
        }
        await helper.run("COMMIT");
    } catch (e) {
        helper.run("ROLLBACK");
        throw e; // Forward the exception to notice the caller that there was an error
    }

    return result;
}

//#region Foreign keys tools --------------------------------------------------

/** 
 * Update item's foreign keys to new uids.
 * @throws If id cannot be updated.
 */
function _updateForeignKeys<Tables extends TablesDefinition, TableName extends keyof Tables>(foreignKeys: ForeignKeys<Tables>, result: SQLTransactionResult, table: TableName, item: Tables[TableName]): void {
    const tableForeignKeys = foreignKeys[table];
    for (const key in tableForeignKeys) {
        if (tableForeignKeys[key]) {
            const temporaryId = item[key as keyof Tables[TableName]] as BaseDTO["id"];
            if (temporaryId == null) {
                continue;
            }
            const newId = _getUpdatedId(result, temporaryId);
            item[key as keyof Tables[TableName]] = newId as Tables[TableName][keyof Tables[TableName]];
        }
    }
}

/** 
 * Get id updated after insert. If id is positive, it is returned as-is.
 * @throws If id is negative and cannot be updated
 */
function _getUpdatedId(result: SQLTransactionResult, id: BaseDTO["id"]): BaseDTO["id"] {
    if (id >= 0) {
        return id;
    } else {
        const newId = result.updatedIds[id] ?? id;
        if (newId == null) {
            throw new Error(`Failed to update ${id}`);
        }
        return result.updatedIds[id] ?? id;
    }
}

//#endregion

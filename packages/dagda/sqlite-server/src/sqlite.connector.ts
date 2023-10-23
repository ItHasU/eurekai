import { AbstractSQLConnector, BaseDTO } from "@dagda/sql-shared/src/abstract.sql.connector";

export class SQLiteConnector<Tables extends Record<string, BaseDTO>> extends AbstractSQLConnector<Tables> {
    
    constructor(filename: string) {
        super();
    }

    protected override _getById<TableName extends keyof Tables, DTO extends Tables[TableName]>(tableName: TableName, id: number): Promise<DTO | undefined> {
        throw new Error("Method not implemented.");
    }

}
import { SQLConnector, BaseDTO, TablesDefinition } from "@dagda/sql-shared/src/sql.types";

export class SQLiteConnector<Tables extends TablesDefinition> implements SQLConnector<Tables> {
    
    constructor(filename: string) {
        
    }

    public override getById<TableName extends keyof Tables, DTO extends Tables[TableName]>(tableName: TableName, id: number): Promise<DTO | undefined> {
        throw new Error("Method not implemented.");
    }

}
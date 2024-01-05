// import { JSTypes } from "../javascript.types";
// import { FieldDefinition, TypeDefinition, TypeHandler } from "../typeHandler";

// type PGTypes = "TEXT" |
//     "BOOLEAN" |
//     "SMALLINT" | "INTEGER" | "BIGINT";

// /** 
//  * This class a PostgreSQL specific data handler.
//  * It ensures that the types used are compatible with PostgreSQL 
//  * and provides SQL utilities.
//  */
// export class PGTypeHandler<
//     Types extends Record<string, TypeDefinition<any, JSTypes, JSTypes, PGTypes>>,
//     Tables extends Record<string, Record<string, FieldDefinition<Types, Tables>>>
// > extends TypeHandler<PGTypes, Types, Tables> {

//     //#region Typed utilities for the SQL requests

//     /** Quoted table name */
//     public qt(table: keyof Tables): string {
//         return `"${table as string}"`;
//     }

//     /** Quoted field from a table */
//     public qf<Table extends keyof Tables>(table: Table, field: keyof Tables[Table], withTable: boolean = true): string {
//         return (withTable ? `"${table as string}".` : "") + `"${field as string}"`;
//     }

//     //#endregion

//     //#region Auto-generated scripts

//     /** Generate the SQL script to create the table */
//     public generateCreateTableSQL<T extends keyof Tables>(table: T): string {
//         const fields = this.getTableFields(table);
//         const fieldDefs = fields.map(field => {
//             const type = this.getFieldType(table, field);
//             let fieldCreation = `${field as string} ${type.dbTypeName}`;
//             if (this.isFieldIdentity(table, field)) {
//                 fieldCreation += " PRIMARY KEY GENERATED ALWAYS AS IDENTITY";
//             }
//             if (this.isFieldOptional(table, field)) {
//                 fieldCreation += " NULL";
//             } else {
//                 fieldCreation += " NOT NULL";
//             }
//             return fieldCreation;
//         });
//         return `CREATE TABLE IF NOT EXISTS ${table as string} (\n${fieldDefs.join(",\n")}\n);`;
//     }

//     //#endregion
// }

import { SQLAdapter, TablesDefinition } from "./types";

export const SQL_URL = "sql";

export type SQLAdapterAPI<Tables extends TablesDefinition, Filter> = Omit<SQLAdapter<Tables, Filter>, "filterEquals">

import { SQLAdapter, TablesDefinition } from "./types";

export const SQL_URL = "sql";

export type SQLAdapterAPI<Tables extends TablesDefinition, Contexts> = Omit<SQLAdapter<Tables, Contexts>, "contextEquals">

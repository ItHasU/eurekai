import { apiCall } from "@dagda/client/api";
import { SQLAdapterAPI, SQL_URL } from "@dagda/shared/sql/api";
import { TablesDefinition } from "@dagda/shared/sql/types";

export function generateFetchFunction<Tables extends TablesDefinition, Filter>(): SQLAdapterAPI<Tables, Filter>["fetch"] {
    return apiCall.bind(null, SQL_URL, "fetch");
}

export function generateSubmitFunction<Tables extends TablesDefinition, Filter>(): SQLAdapterAPI<Tables, Filter>["submit"] {
    return apiCall.bind(null, SQL_URL, "submit");
}

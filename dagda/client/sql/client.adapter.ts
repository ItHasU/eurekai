import { apiCall } from "@dagda/client/api";
import { SQLAdapterAPI, SQL_URL } from "@dagda/shared/sql/api";
import { TablesDefinition } from "@dagda/shared/sql/types";

export function generateFetchFunction<Tables extends TablesDefinition, Contexts>(): SQLAdapterAPI<Tables, Contexts>["fetch"] {
    return apiCall.bind(null, SQL_URL, "fetch");
}

export function generateSubmitFunction<Tables extends TablesDefinition, Contexts>(): SQLAdapterAPI<Tables, Contexts>["submit"] {
    return apiCall.bind(null, SQL_URL, "submit");
}

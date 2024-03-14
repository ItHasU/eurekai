export type ENV_VARIABLES_STR =
    "BASE_URL" |
    "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET" |
    "API_URL" | "API_WOL_SCRIPT" | // User can pass a script to wake the server
    "REPLICATE_TOKEN" | "REPLICATE_MODELS" |
    "OPENAI_API_TOKEN" |
    "DATABASE_URL";
export type ENV_VARIABLES_NUMBER = "PORT";

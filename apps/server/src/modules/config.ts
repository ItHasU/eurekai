export type ENV_VARIABLES_STR =
    "BASE_URL" |
    "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET" |
    "COMFY_URL" | "COMFY_PATH" | "COMFY_WOL_SCRIPT" | // User can pass a script to wake the server
    "API_URL" | "API_WOL_SCRIPT" | // User can pass a script to wake the server
    "REPLICATE_TOKEN" | "REPLICATE_MODELS_SDXL" | "REPLICATE_MODELS_FLUX" |
    "OPENAI_API_TOKEN" |
    "DATABASE_URL";
export type ENV_VARIABLES_NUMBER = "PORT";

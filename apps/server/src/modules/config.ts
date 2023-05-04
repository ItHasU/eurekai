type ENV_VARIABLES_STR = "API_URL";
type ENV_VARIABLES_NUMBER = "PORT";

import { env } from "node:process";


export function getEnvString(key: ENV_VARIABLES_STR): string {
    const value = env[key];
    if (value == null) {
        throw `Missing environment property: ${key}`;
    } else {
        return value;
    }
}

export function getEnvNumber(key: ENV_VARIABLES_NUMBER): number {

}
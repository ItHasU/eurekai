import { env } from "node:process";

export function getEnvString<ENV_VARIABLES_STR extends string = string>(key: ENV_VARIABLES_STR): string {
    const value = getEnvStringOptional(key);
    if (value == null) {
        throw `Missing environment property: ${key}`;
    } else {
        return value;
    }
}

export function getEnvStringOptional<ENV_VARIABLES_STR extends string = string>(key: ENV_VARIABLES_STR): string | undefined {
    const value = env[key];
    if (value == null) {
        return undefined;
    } else {
        return value;
    }
}

export function getEnvNumber<ENV_VARIABLES_NUMBER extends string>(key: ENV_VARIABLES_NUMBER, defaultValue?: number): number {
    const valueStr = env[key];
    if (valueStr == null) {
        if (defaultValue === undefined) {
            throw `Missing environment property: ${key}`;
        } else {
            return defaultValue;
        }
    } else {
        const value = +valueStr;
        if (isNaN(value)) {
            throw `Invalid value ${key}=${valueStr} (expecting a number)`;
        } else {
            return value;
        }
    }
}
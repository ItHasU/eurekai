export const SYSTEM_URL = "system";

export interface SystemInfo {
    /** Start date */
    startTimeMilliseconds: number;
    /** List of uncaught errors */
    errors: string[];
}

export type SystemAPI = {
    getSystemInfo: () => Promise<SystemInfo>;
    triggerError: () => Promise<void>;
}
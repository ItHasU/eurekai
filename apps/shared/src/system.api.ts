export const SYSTEM_URL = "system";

export interface SystemInfo {
    /** Start date */
    startTimeMilliseconds: number;
    /** List of uncaught errors */
    errors: string[];
}

export type SystemAPI<H> = {
    getSystemInfo: (h: H) => Promise<SystemInfo>;
    triggerError: (h: H) => Promise<void>;
}
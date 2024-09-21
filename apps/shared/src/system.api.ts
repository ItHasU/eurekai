export const SYSTEM_URL = "system";

export interface SystemInfo {
    /** Uptime in seconds */
    uptime: number;
}

export type SystemAPI = {
    getSystemInfo: () => Promise<SystemInfo>;
}
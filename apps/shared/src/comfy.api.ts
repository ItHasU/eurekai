export const COMFY_URL = "comfy";

/** One line of the ComfyUI activity log */
export interface ComfyLogEntry {
    /** Incremental id, used by the client as a cursor to only fetch what it has not seen yet */
    id: number;
    /** Host the entry comes from */
    host: string;
    /** Timestamp in milliseconds */
    time: number;
    level: "info" | "error";
    message: string;
}

/** Live state of one ComfyUI host, as seen by the monitoring websocket */
export interface ComfyHostStatus {
    host: string;
    /** State of the monitoring websocket. Generation does not depend on it. */
    connected: boolean;
    /** Number of prompts left in the ComfyUI queue, null while unknown */
    queueRemaining: number | null;
    /** Prompt being executed, null when idle */
    promptId: string | null;
    /** Picture the prompt was enqueued for, null if the prompt was not sent by us */
    pictureId: number | null;
    /** Model used to generate the picture */
    model: string | null;
    /** Start of the execution, so the client can compute the elapsed time itself */
    startedAt: number | null;
    /** Node being executed, null when idle */
    nodeId: string | null;
    /** Progress inside the current node (sampling steps, typically) */
    progress: { value: number; max: number } | null;
    /**
     * Free-form progress reported by nodes that cannot give a numeric value, typically a custom
     * node calling a remote API (Minimax, ...) instead of running a local step-based sampler.
     * ComfyUI carries it as a binary "progress_text" websocket frame, separate from "progress".
     */
    progressText: string | null;
}

export interface ComfyStatus {
    hosts: ComfyHostStatus[];
    /** Entries with an id greater than the requested sinceLogId, oldest first */
    logs: ComfyLogEntry[];
    /** Id of the last known entry, to be passed as sinceLogId on the next call */
    lastLogId: number;
}

export type ComfyAPI = {
    getStatus: (sinceLogId?: number) => Promise<ComfyStatus>;
}

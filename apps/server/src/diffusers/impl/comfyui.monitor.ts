import { ComfyHostStatus, ComfyLogEntry } from "@eurekai/shared/src/comfy.api";
import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";

//#region Timings

/** Timeout of the websocket handshake. A sleeping machine must fail fast, not hang on the TCP timeout. */
const HANDSHAKE_TIMEOUT_MS = 5_000;
/** Delay before the first reconnection attempt */
const RECONNECT_MIN_MS = 5_000;
/** Maximum delay between two reconnection attempts, once the host is clearly down */
const RECONNECT_MAX_MS = 60_000;

//#endregion

/** Number of log entries kept in memory, per host */
const MAX_LOG_ENTRIES = 300;

/**
 * Id of the next log entry, shared by every host.
 * The client merges the logs of all the hosts and follows them with a single cursor, which only
 * works if the ids come from a single sequence.
 */
let nextLogId: number = 1;

/** Format a duration in a compact readable form : "12.3s", "3m07s" */
export function formatDuration(ms: number): string {
    // Round to tenths first, so that 59.99s reads "1m00s" and never "60.0s"
    const tenths = Math.round(ms / 100);
    if (tenths < 600) {
        return `${(tenths / 10).toFixed(1)}s`;
    }
    const seconds = Math.round(tenths / 10);
    return `${Math.floor(seconds / 60)}m${(seconds % 60).toString().padStart(2, "0")}s`;
}

/** What a prompt was enqueued for, so the monitor can tell which picture is being generated */
export interface GenerationJobInfo {
    pictureId: number;
    model: string;
}

/** A message received on the ComfyUI websocket */
interface WSMessage {
    type?: string;
    data?: Record<string, unknown>;
}

/**
 * Observes one ComfyUI host through its /ws websocket.
 *
 * ComfyUI routes the execution events (execution_start, executing, progress, ...) to the session
 * that enqueued the prompt, identified by the client_id sent in POST /prompt. This is why the
 * monitor owns the clientId : ComfyUIPool enqueues with it, so the events come back here.
 * Without that, ComfyUI sends them to a session nobody listens to and they are dropped.
 *
 * This is purely observational : the generation itself relies on polling /queue and /history.
 * If the websocket never connects, generation behaves exactly as it did before.
 */
export class ComfyUIMonitor {

    /**
     * Identifier of our ComfyUI session. Generated once and kept for the whole lifetime of the
     * server : reconnecting with the same id resumes the events of a prompt that is still running.
     */
    public readonly clientId: string = randomUUID();

    //#region State reported to the administration page

    protected _connected: boolean = false;
    protected _queueRemaining: number | null = null;
    protected _promptId: string | null = null;
    protected _startedAt: number | null = null;
    protected _nodeId: string | null = null;
    protected _progress: { value: number; max: number } | null = null;
    protected _progressText: string | null = null;

    /** Job of each prompt we enqueued, keyed by prompt id */
    protected readonly _jobs: Map<string, GenerationJobInfo> = new Map();

    //#endregion

    //#region Log

    protected readonly _logs: ComfyLogEntry[] = [];

    //#endregion

    protected _socket: WebSocket | null = null;
    protected _reconnectDelay: number = RECONNECT_MIN_MS;

    constructor(protected readonly _host: string, protected readonly _apiHost: string) {
    }

    //#region Log ------------------------------------------------------------

    /**
     * Append a line to the ComfyUI log and print it.
     * The console call is kept so that the container logs stay exactly what they were.
     */
    public log(level: ComfyLogEntry["level"], message: string): void {
        this._logs.push({
            id: nextLogId++,
            host: this._host,
            time: Date.now(),
            level,
            message
        });
        while (this._logs.length > MAX_LOG_ENTRIES) {
            this._logs.shift();
        }
        if (level === "error") {
            console.error(message);
        } else {
            console.log(message);
        }
    }

    /** @returns The entries the client has not seen yet */
    public getLogs(sinceLogId?: number): ComfyLogEntry[] {
        if (sinceLogId == null) {
            return [...this._logs];
        }
        return this._logs.filter(entry => entry.id > sinceLogId);
    }

    /** @returns The id of the last entry logged by any host, 0 when nothing was logged yet */
    public static getLastLogId(): number {
        return nextLogId - 1;
    }

    //#endregion

    //#region Job tracking ---------------------------------------------------

    /** Remember which picture a prompt was enqueued for */
    public setJob(promptId: string, job: GenerationJobInfo | undefined): void {
        if (job == null) {
            return;
        }
        this._jobs.set(promptId, job);
    }

    /** Forget a prompt, once the generation is over (successfully or not) */
    public clearJob(promptId: string | null): void {
        if (promptId != null) {
            this._jobs.delete(promptId);
        }
    }

    //#endregion

    //#region Status ---------------------------------------------------------

    public getStatus(): ComfyHostStatus {
        const job = this._promptId == null ? undefined : this._jobs.get(this._promptId);
        return {
            host: this._host,
            connected: this._connected,
            queueRemaining: this._queueRemaining,
            promptId: this._promptId,
            pictureId: job?.pictureId ?? null,
            model: job?.model ?? null,
            startedAt: this._startedAt,
            nodeId: this._nodeId,
            progress: this._progress,
            progressText: this._progressText
        };
    }

    /** Forget everything about the prompt that was running */
    protected _resetCurrentPrompt(): void {
        this._promptId = null;
        this._startedAt = null;
        this._nodeId = null;
        this._progress = null;
        this._progressText = null;
    }

    //#endregion

    //#region Websocket ------------------------------------------------------

    /** Open the websocket and keep it open. Never throws, a failure is only retried. */
    public start(): void {
        if (this._socket != null) {
            return;
        }

        let socket: WebSocket;
        try {
            socket = new WebSocket(`ws://${this._apiHost}/ws?clientId=${this.clientId}`, {
                handshakeTimeout: HANDSHAKE_TIMEOUT_MS
            });
        } catch (e) {
            // A malformed host would throw synchronously, keep retrying anyway
            this._onDisconnected(`${e}`);
            return;
        }
        this._socket = socket;

        socket.on("open", () => {
            this._reconnectDelay = RECONNECT_MIN_MS;
            // Only log the transition : the machine is allowed to sleep, we don't want one line
            // per failed attempt while it is off
            if (!this._connected) {
                this._connected = true;
                this.log("info", `Connected to the ComfyUI websocket on ${this._host}`);
            }
        });

        socket.on("message", (data: unknown, isBinary: boolean) => {
            try {
                if (isBinary) {
                    // Most binary frames are live previews, which we don't display, but nodes
                    // that can't report a numeric step (typically a wrapper around a remote API,
                    // ex. Minimax) send their progress as text through this same channel
                    this._onBinaryMessage(data as Buffer);
                } else {
                    this._onMessage(JSON.parse(String(data)) as WSMessage);
                }
            } catch (e) {
                // A message we cannot read must never break the monitoring
                console.error(`Failed to handle a ComfyUI websocket message from ${this._host}`, e);
            }
        });

        socket.on("error", (e: Error) => {
            // "error" is always followed by "close", the reconnection is scheduled there
            this._lastError = e.message;
        });

        socket.on("close", () => {
            this._onDisconnected(this._lastError);
            this._lastError = undefined;
        });
    }

    /** Reason of the last socket error, reported once the socket closes */
    protected _lastError: string | undefined = undefined;

    /** Drop the socket, report the transition and schedule a new attempt */
    protected _onDisconnected(reason: string | undefined): void {
        this._socket = null;
        if (this._connected) {
            this._connected = false;
            this._queueRemaining = null;
            this._resetCurrentPrompt();
            this.log("error", `Lost the ComfyUI websocket on ${this._host}${reason ? ` : ${reason}` : ""}`);
        }

        // Back off so that a machine that is off for hours does not retry every 5s forever
        // Don't hold the event loop open just for the retry
        setTimeout(() => this.start(), this._reconnectDelay).unref();
        this._reconnectDelay = Math.min(this._reconnectDelay * 2, RECONNECT_MAX_MS);
    }

    /**
     * ComfyUI's binary frames are not JSON, they use their own tiny framing : a 4 byte big
     * endian type marker, followed by a type-specific payload. We only care about type 3
     * (progress_text) :
     *   bytes [0,4)      the type marker, 3
     *   bytes [4,8)      length of the node id, in bytes
     *   bytes [8,8+len)  the node id, utf8
     *   bytes [8+len,)   the text, utf8, the rest of the frame
     * Types 1 (preview image) and 4 (preview image + metadata) exist too, we ignore them : no
     * live preview is displayed, only text and numbers.
     */
    protected _onBinaryMessage(buffer: Buffer): void {
        if (buffer.length < 8) {
            return;
        }
        const type = buffer.readUInt32BE(0);
        if (type !== 3) {
            return;
        }
        const nodeIdLength = buffer.readUInt32BE(4);
        const nodeId = buffer.toString("utf8", 8, 8 + nodeIdLength);
        const text = buffer.toString("utf8", 8 + nodeIdLength);

        // State only, like numeric progress : a remote API node can report several times a
        // second and would flood the log
        this._progressText = text;
        if (nodeId && nodeId !== this._nodeId) {
            this._nodeId = nodeId;
            this._progress = null;
        }
    }

    protected _onMessage(message: WSMessage): void {
        const data = message.data ?? {};
        switch (message.type) {
            case "status": {
                const remaining = (data["status"] as { exec_info?: { queue_remaining?: number } } | undefined)?.exec_info?.queue_remaining;
                if (typeof remaining === "number" && remaining !== this._queueRemaining) {
                    this._queueRemaining = remaining;
                    this.log("info", `Queue of ${this._host} : ${remaining} prompt(s)`);
                }
                break;
            }
            case "execution_start": {
                this._resetCurrentPrompt();
                this._promptId = String(data["prompt_id"]);
                this._startedAt = Date.now();
                const job = this._jobs.get(this._promptId);
                const forPicture = job == null ? "" : ` (picture ${job.pictureId}, ${job.model})`;
                this.log("info", `Execution of ${this._promptId} started${forPicture}`);
                break;
            }
            case "execution_cached": {
                const nodes = data["nodes"];
                const count = Array.isArray(nodes) ? nodes.length : 0;
                if (count > 0) {
                    this.log("info", `${count} node(s) reused from the cache`);
                }
                break;
            }
            case "executing": {
                // A null node means the prompt is done executing
                const node = data["node"];
                const nodeId = node == null ? null : String(node);
                if (nodeId !== this._nodeId) {
                    this._nodeId = nodeId;
                    // Progress is reported per node, it means nothing across a node change
                    this._progress = null;
                    this._progressText = null;
                    if (nodeId != null) {
                        this.log("info", `Executing node ${nodeId}`);
                    }
                }
                break;
            }
            case "progress": {
                // State only : logging every sampling step would flood the log
                const value = data["value"];
                const max = data["max"];
                if (typeof value === "number" && typeof max === "number") {
                    this._progress = { value, max };
                }
                break;
            }
            case "execution_success": {
                const duration = this._startedAt == null ? null : Date.now() - this._startedAt;
                const took = duration == null ? "" : ` in ${formatDuration(duration)}`;
                this.log("info", `Execution of ${data["prompt_id"]} succeeded${took}`);
                this._resetCurrentPrompt();
                break;
            }
            case "execution_error": {
                const node = [data["node_type"], data["node_id"]].filter(v => v != null).join(" #");
                const exception = [data["exception_type"], data["exception_message"]].filter(v => v != null).join(" : ");
                this.log("error", `Execution of ${data["prompt_id"]} failed : ${[node && `node ${node}`, exception].filter(Boolean).join(" -> ")}`);
                this._resetCurrentPrompt();
                break;
            }
            case "execution_interrupted": {
                this.log("error", `Execution of ${data["prompt_id"]} was interrupted`);
                this._resetCurrentPrompt();
                break;
            }
            default:
                // executed, progress_state, ... nothing to report
                break;
        }
    }

    //#endregion
}

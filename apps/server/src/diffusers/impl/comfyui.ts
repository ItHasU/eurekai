import { asNamed } from "@dagda/shared/entities/named.types";
import { wait } from "@dagda/shared/tools/async";
import { AppTypes } from "@eurekai/shared/src/entities";
import { ModelInfo } from "@eurekai/shared/src/models.api";
import { Client, ClientConnectionError, ClientRequestError, ConnectError } from "@stable-canvas/comfyui-client";
import JSZip from "jszip";
import { exec } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { AbstractDiffuser, ImageDescription } from "../diffuser";

//#region Timings

/** Timeout applied to every individual HTTP request sent to ComfyUI */
const HTTP_TIMEOUT_MS = 30_000;
/** Timeout of the /system_stats liveness probe */
const PROBE_TIMEOUT_MS = 5_000;
/** Timeout to download a generated media (a video can be heavy) */
const DOWNLOAD_TIMEOUT_MS = 120_000;
/** Total budget to wait for the machine to wake up */
const WAKE_BUDGET_MS = 240_000;
/** Delay between two probes while waiting for the machine to wake up */
const WAKE_POLL_MS = 5_000;
/** Delay between two magic packets while waiting for the machine to wake up */
const WOL_RESEND_MS = 60_000;
/** Number of "wake up + (re)start" cycles before giving up */
const MAX_WAKE_CYCLES = 3;
/** Duration during which the host is considered alive without probing it again */
const ALIVE_CACHE_MS = 30_000;
/** Default generation deadline, used when the manifest does not override it */
const DEFAULT_TIMEOUT_MS = 300_000;
/** Delay between two polls of the prompt status */
const PROMPT_POLLING_MS = 1_000;

//#endregion

//#region Network tools

/** Build a fetch function aborting the request after the given delay */
function fetchWithTimeout(timeout_ms: number): typeof fetch {
    return (input: any, init?: any) => fetch(input, { ...init, signal: AbortSignal.timeout(timeout_ms) });
}

/** Error codes reported by undici when the remote host cannot be reached */
const NETWORK_ERROR_CODES: string[] = [
    "ECONNREFUSED", "EHOSTUNREACH", "ENETUNREACH", "ETIMEDOUT",
    "ECONNRESET", "EAI_AGAIN", "EPIPE", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT"
];

/**
 * @returns true if the error means the machine stopped answering (as opposed to a generation error).
 * Only network errors are worth a WakeOnLAN, a generation error must fail immediately.
 */
export function isNetworkError(e: unknown): boolean {
    if (e == null || typeof e !== "object") {
        return false;
    }

    // -- Aborted by AbortSignal.timeout() --
    const name = (e as { name?: unknown }).name;
    if (name === "TimeoutError" || name === "AbortError") {
        return true;
    }

    // -- Connection error reported by the ComfyUI client --
    if (e instanceof ClientConnectionError || e instanceof ClientRequestError || e instanceof ConnectError) {
        return true;
    }

    // -- "TypeError: fetch failed", the real reason is in the cause --
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string" && NETWORK_ERROR_CODES.includes(code)) {
        return true;
    }
    const cause = (e as { cause?: unknown }).cause;
    if (cause != null && cause !== e) {
        return isNetworkError(cause);
    }

    return false;
}

//#endregion

//#region Diffuser

/** Diffuser options */
interface ComfyUIDiffuserOption {
    /** Server URL */
    serverURL: string;
    /** WakeOnLAN URL */
    wolScript?: string;
    /** UID */
    uid: string;
    /** Name */
    name: string;
    /** Is output video */
    video: boolean;
    /** Override waiting timeout (default to 5 minutes) */
    timeout_ms?: number;
    /** Size ratio (eg 512, 1024) */
    size: number;
    /** Round the generated resolutions to a multiple of this value (default to 8) */
    sizeStep?: number;
    /** Prompt template */
    promptTemplate: string;
}

export type Prompt = Record<string, unknown>;

/** A media referenced by a node output, as returned by GET /history/{prompt_id} */
interface OutputMedia {
    filename?: string;
    subfolder?: string;
    /** "output" and "temp" are readable through /view, "input" is not a generated media */
    type?: string;
}

/** An entry of GET /history/{prompt_id}, keyed by node id */
interface HistoryEntry {
    outputs?: Record<string, { images?: OutputMedia[] } | undefined>;
    status?: { status_str?: string };
}

export class ComfyUIDiffuser extends AbstractDiffuser {

    constructor(private readonly _options: ComfyUIDiffuserOption) {
        super();
    }

    //#region Abstract methods

    /** @inheritdoc */
    public override getLock(options: ImageDescription): string | null {
        // Make sure that the server is only called once at a time
        return this._options.serverURL;
    }

    /** @inheritdoc */
    public override getModelInfo(): ModelInfo {
        return {
            uid: `comfy_${this._options.uid}`,
            displayName: `[Comfy] ${this._options.name}`,
            video: this._options.video,
            size: this._options.size,
            sizeStep: this._options.sizeStep
        };
    }

    /**
     * @inheritdoc
     *
     * The remote machine is allowed to fall asleep at any time. On a network error we send a
     * WakeOnLAN request, wait for the machine to answer again and then resume the prompt that
     * was already enqueued (ComfyUI keeps its queue across a sleep). If ComfyUI lost the prompt
     * (the machine rebooted), the prompt is enqueued again.
     *
     * Any other error (invalid workflow, GPU out of memory, ...) fails immediately.
     */
    public override async txt2img(image: ImageDescription): Promise<{ data: AppTypes["BASE64_DATA"] }> {
        const pool = ComfyUIDiffuser._getPool(this._options.serverURL);
        // Budget of the generation itself. It is not re-armed on each cycle, but the time spent
        // waking the machine up is added back to it : the deadline must bound the generation,
        // not the wake up. The total duration of txt2img stays bounded by
        // MAX_WAKE_CYCLES * WAKE_BUDGET_MS + timeout_ms.
        let deadline = Date.now() + (this._options.timeout_ms ?? DEFAULT_TIMEOUT_MS);
        let promptId: string | null = null;

        for (let cycle = 0; cycle < MAX_WAKE_CYCLES; cycle++) {
            // -- Make sure the machine is up before doing anything --
            const wakeStart = Date.now();
            await pool.ensureAwake(this._options.wolScript);
            deadline += Date.now() - wakeStart;

            try {
                // -- Enqueue the prompt, unless we already have one to resume --
                if (promptId == null) {
                    promptId = await pool.enqueue(this._options.promptTemplate, image);
                    console.log(`Prompt enqueued on ${this._options.serverURL} : ${promptId}`);
                } else {
                    console.log(`Resuming prompt ${promptId} on ${this._options.serverURL}`);
                }

                // -- Wait for the result --
                const remaining = deadline - Date.now();
                if (remaining <= 0) {
                    throw `Timeout while generating image on ${this._options.serverURL}`;
                }
                const images = await pool.waitAndFetch(promptId, remaining);
                if (images == null) {
                    // ComfyUI does not know this prompt anymore, the queue was lost on a reboot
                    console.error(`Prompt ${promptId} is unknown to the server, enqueuing it again`);
                    promptId = null;
                    continue;
                }
                if (images.length === 0) {
                    throw "No image generated";
                }
                return { data: asNamed(images[0]) };
            } catch (e) {
                if (!isNetworkError(e)) {
                    // A generation error, waking the machine up won't help
                    throw e;
                }
                if (Date.now() >= deadline) {
                    throw e;
                }
                // The machine fell asleep, keep promptId so that the next cycle resumes it
                console.error(e);
                console.error(`Lost connection to ${this._options.serverURL}, will try to wake it up (cycle ${cycle + 1}/${MAX_WAKE_CYCLES})`);
            }
        }

        throw `Failed to generate image after ${MAX_WAKE_CYCLES} wake up cycles`;
    }

    //#endregion

    //#region Pool connection

    protected static readonly _connectionPool: Map<string, ComfyUIPool> = new Map();

    protected static _getPool(serverURL: string): ComfyUIPool {
        let pool = ComfyUIDiffuser._connectionPool.get(serverURL);
        if (pool != null) {
            return pool;
        }
        pool = new ComfyUIPool(serverURL);
        ComfyUIDiffuser._connectionPool.set(serverURL, pool);
        return pool;
    }

    //#endregion
}

//#endregion

//#region ComfyUI pool

/**
 * ComfyUIClient wrapper.
 * One instance per host, shared by all the models of that host so that they share
 * the knowledge of whether the machine is up or not.
 */
export class ComfyUIPool {

    /** Timestamp until which the host is known to be alive */
    protected _aliveUntil: number = 0;

    constructor(protected _host: string) {
    }

    //#region Wake on LAN

    /**
     * Base URL of the server.
     *
     * The host is expected to be a bare "address:port" (this is what the ComfyUI client expects
     * too), but we tolerate a scheme and trailing slashes so that a COMFY_HOST written as
     * "http://192.168.42.20:8188/" does not silently make every probe fail.
     */
    protected get _apiHost(): string {
        return this._host.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    }

    protected get _baseURL(): string {
        return `http://${this._apiHost}`;
    }

    /**
     * Probe the server with a short timeout.
     * @returns true if the server answered, false otherwise. Never throws.
     */
    protected async _isAlive(): Promise<boolean> {
        const url = `${this._baseURL}/system_stats`;
        try {
            const response = await fetch(url, {
                signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
            });
            if (!response.ok) {
                // The machine is up but answers something unexpected : a WOL won't help, but we
                // still want to know about it
                console.error(`Probe ${url} answered ${response.status} ${response.statusText}`);
                return false;
            }
            return true;
        } catch (e) {
            // Log the reason, otherwise a misconfigured host looks exactly like a sleeping machine
            const reason = (e as { cause?: { code?: string } })?.cause?.code ?? (e as Error)?.name ?? e;
            console.error(`Probe ${url} failed : ${reason}`);
            return false;
        }
    }

    /** Run the WakeOnLAN script. Never throws, a failure is only logged. */
    protected async _sendWOL(wolScript: string): Promise<void> {
        try {
            await new Promise<void>((resolve, reject) => {
                console.log(`Sending WOL request to ${this._host} : ${wolScript}`);
                exec(wolScript, (error: unknown) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });
        } catch (e) {
            // Don't rethrow, we still want to wait for the machine in case the packet went through
            console.error("Failed to send WOL request", e);
        }
    }

    /**
     * Make sure the host answers. If it does not, run the WakeOnLAN script and wait for the
     * machine to boot, re-sending the magic packet regularly.
     * @throws If the host is still not answering once the budget is over
     */
    public async ensureAwake(wolScript?: string): Promise<void> {
        // -- Fast path, we know the machine was up a few seconds ago --
        if (Date.now() < this._aliveUntil) {
            return;
        }

        if (await this._isAlive()) {
            this._aliveUntil = Date.now() + ALIVE_CACHE_MS;
            return;
        }

        if (!wolScript) {
            // No WOL script, we can't do anything about it
            throw `Server ${this._host} is not answering and no WOL script is configured`;
        }

        // -- Wake the machine up and wait for it --
        const deadline = Date.now() + WAKE_BUDGET_MS;
        let lastWOL = 0;
        while (Date.now() < deadline) {
            if (Date.now() - lastWOL >= WOL_RESEND_MS) {
                lastWOL = Date.now();
                await this._sendWOL(wolScript);
            }
            await wait(WAKE_POLL_MS);
            if (await this._isAlive()) {
                console.log(`Server ${this._host} is up`);
                this._aliveUntil = Date.now() + ALIVE_CACHE_MS;
                return;
            }
        }

        throw `Failed to wake up server ${this._host} after ${Math.round(WAKE_BUDGET_MS / 1000)}s`;
    }

    /** Mark the host as unreachable so the next call probes it again */
    protected _markAsDown(): void {
        this._aliveUntil = 0;
    }

    //#endregion

    //#region Generation

    /** Build a new client. Every request will fail fast thanks to the custom fetch. */
    protected _newClient(): Client {
        return new Client({
            api_host: this._apiHost,
            api_base: "",
            sessionName: "",
            fetch: fetchWithTimeout(HTTP_TIMEOUT_MS)
        });
    }

    /** Replace the $param$ placeholders of the template by the image description */
    protected _buildPrompt(template: string, params: ImageDescription): Prompt {
        let promptStr = template;

        // Replace parameters in the format $param$
        for (const param in params) {
            const value = JSON.stringify(params[param as keyof ImageDescription] ?? null);
            const pattern = `$${param}$`;
            promptStr = promptStr.replaceAll(pattern, value);
        }
        return JSON.parse(promptStr);
    }

    /**
     * Enqueue the prompt without waiting for the result.
     * @returns The id of the enqueued prompt, to be passed to waitAndFetch()
     */
    public async enqueue(template: string, params: ImageDescription): Promise<string> {
        const prompt = this._buildPrompt(template, params);
        const client = this._newClient();
        try {
            const resp = await client._enqueue_prompt(prompt);
            return resp.prompt_id;
        } catch (e) {
            if (isNetworkError(e)) {
                this._markAsDown();
            }
            throw e;
        } finally {
            client.close();
        }
    }

    /**
     * GET on the ComfyUI API, with a timeout.
     *
     * We deliberately don't use the client's getQueue() / getHistory() here : both of them
     * swallow network errors and return an empty result. That would make a sleeping machine
     * look like "the prompt is done and unknown", which is exactly what we need to detect.
     * Here, a network error propagates.
     */
    protected async _get<T>(path: string): Promise<T> {
        const response = await fetch(`${this._baseURL}${path}`, {
            headers: { Accept: "*/*" },
            signal: AbortSignal.timeout(HTTP_TIMEOUT_MS)
        });
        if (!response.ok) {
            throw new Error(`GET ${path} failed : ${response.status} ${response.statusText}`);
        }
        return (await response.json()) as T;
    }

    /** @returns true if the prompt is still running or waiting in the ComfyUI queue */
    protected async _isQueued(promptId: string): Promise<boolean> {
        const queue = await this._get<{ queue_running?: unknown[]; queue_pending?: unknown[] }>("/queue");
        // Queue items are tuples [number, prompt_id, prompt, extra_data, outputs]
        const idOf = (item: unknown): unknown => Array.isArray(item) ? item[1] : undefined;
        const items = [...(queue.queue_running ?? []), ...(queue.queue_pending ?? [])];
        return items.some(item => idOf(item) === promptId);
    }

    /** @returns The history entry of the prompt, or null if the server does not know it */
    protected async _getHistoryEntry(promptId: string): Promise<HistoryEntry | null> {
        const history = await this._get<Record<string, HistoryEntry>>(`/history/${promptId}`);
        return history[promptId] ?? null;
    }

    /**
     * Extract the media URLs of a finished prompt.
     * Same semantics as the client's default resolver : only the "images" outputs of type
     * "output" or "temp" are kept (this is what the video workflows use too).
     */
    protected _getMediaURLs(entry: HistoryEntry): string[] {
        const urls: string[] = [];
        for (const output of Object.values(entry.outputs ?? {})) {
            for (const image of output?.images ?? []) {
                if (image.filename == null || image.subfolder == null) {
                    continue;
                }
                if (image.type !== "output" && image.type !== "temp") {
                    continue;
                }
                const params = new URLSearchParams({
                    filename: image.filename,
                    subfolder: image.subfolder,
                    type: image.type
                });
                urls.push(`${this._baseURL}/view?${params.toString()}`);
            }
        }
        return urls;
    }

    /**
     * Wait for the prompt to be done then download the generated medias.
     *
     * The queue is checked before the history so that a prompt finishing between the two calls
     * is still found (no race).
     *
     * @param timeout_ms Remaining time to wait for the prompt
     * @returns The medias as base64 strings, or null if the server does not know this prompt
     * anymore (its queue was lost on a reboot), meaning the caller should enqueue it again.
     * @throws A network error as soon as the machine stops answering
     */
    public async waitAndFetch(promptId: string, timeout_ms: number): Promise<string[] | null> {
        const deadline = Date.now() + timeout_ms;
        try {
            // -- Wait for the prompt to leave the queue --
            console.log(`Waiting up to ${timeout_ms} ms for prompt ${promptId}`);
            let entry: HistoryEntry | null = null;
            while (true) {
                if (!await this._isQueued(promptId)) {
                    // Not in the queue anymore : either it is done, or the server lost it
                    entry = await this._getHistoryEntry(promptId);
                    break;
                }
                if (Date.now() >= deadline) {
                    throw `Timeout waiting for prompt ${promptId} on ${this._host}`;
                }
                await wait(PROMPT_POLLING_MS);
            }

            if (entry == null) {
                // Unknown to both the queue and the history, the server was restarted
                return null;
            }
            if (entry.status?.status_str === "error") {
                throw `Prompt ${promptId} failed on ${this._host}`;
            }

            // -- Download the medias --
            const download = fetchWithTimeout(DOWNLOAD_TIMEOUT_MS);
            const results: string[] = [];
            for (const url of this._getMediaURLs(entry)) {
                const mediaResp = await download(url);
                if (!mediaResp.ok) {
                    throw new Error(`Failed to download ${url} : ${mediaResp.status} ${mediaResp.statusText}`);
                }
                const buffer = await mediaResp.arrayBuffer();
                results.push(Buffer.from(buffer).toString("base64"));
            }

            // -- Clean up --
            const client = this._newClient();
            try {
                await client.deleteItem("history", promptId);
            } catch (e) {
                // We don't care about the error, we won't throw
                console.error(`Failed to delete image from queue: ${promptId}`);
                console.error(e);
            } finally {
                client.close();
            }

            return results;
        } catch (e) {
            if (isNetworkError(e)) {
                this._markAsDown();
            }
            throw e;
        }
    }

    //#endregion
}

//#endregion

//#region List all diffusers

/** Manifest description */
export interface Manifest {
    /** Short name displayed in the select */
    name: string;
    /** Size ratio (eg. 512, 1024) */
    size: number;
    /** Round the generated resolutions to a multiple of this value (will use 8 by default) */
    sizeStep?: number;
    /** Description */
    description?: string;
    /** Prompt filename (will use api.json by default) */
    filename?: string;
    /** Is output video ? (will use false by default) */
    video?: boolean;
    /** Override timeout in milliseconds */
    timeout_ms?: number;
}

/**
 * List all the ComfyUI workflows found in comfyPath and build one diffuser per workflow.
 *
 * This function is purely local : it only reads the zip files, it never contacts the ComfyUI
 * server. This is intentional, the list of models must stay available without waking the remote
 * machine up. The machine is only woken up when an image is actually generated.
 *
 * @param wolScript Script used by the diffusers to wake the machine up when generating
 * @return The list of diffusers
 * @throws An error if the workflow directory cannot be read
 */
export async function getAllComfyTemplates(comfyHost: string, comfyPath: string, wolScript?: string): Promise<ComfyUIDiffuser[]> {
    // -- List all zip files --------------------------------------------------
    const zipFiles: string[] = [];
    try {
        const files = await fs.readdir(comfyPath);
        for (const file of files) {
            if (path.extname(file).toLowerCase() === '.zip') {
                zipFiles.push(path.join(comfyPath, file));
            }
        }
    } catch (error) {
        throw `Failed to read directory ${comfyPath}: ${error}`;
    }

    // -- Check manifests, create diffusers -----------------------------------
    const diffusers: ComfyUIDiffuser[] = [];
    for (const zipFilePath of zipFiles) {
        try {
            // -- Open zip file -----------------------------------------------
            const fileContent = await fs.readFile(zipFilePath);
            const uid = path.basename(zipFilePath, ".zip");

            const zip = await JSZip.loadAsync(toArrayBuffer(fileContent));
            const manifestFile = zip.files["manifest.json"];
            if (manifestFile == null) {
                console.error(`Invalid zip file, no manifest.json : ${zipFilePath}`);
                continue;
            }

            // -- Read manifest -----------------------------------------------
            const manifestStr = await zip.files["manifest.json"].async("string");
            const manifest: Manifest = JSON.parse(manifestStr);
            const name = manifest.name;
            const size = manifest.size;
            const sizeStep = manifest.sizeStep;
            const video: boolean = manifest.video ?? false;
            const timeout_ms = manifest.timeout_ms;

            // -- Read prompt -------------------------------------------------
            const promptFilename = manifest.filename ?? "api.json";
            const promptTemplate = await zip.files[promptFilename].async("string");

            diffusers.push(new ComfyUIDiffuser({
                serverURL: comfyHost,
                wolScript,

                uid,
                name,
                size,
                sizeStep,
                video,
                timeout_ms,
                promptTemplate
            }));
        } catch (e) {
            console.error(`Failed to load : ${zipFilePath}`);
            console.error(e);
        }
    }

    return diffusers;
}

//#endregion

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
    const arrayBuffer = new ArrayBuffer(buffer.length);
    const view = new Uint8Array(arrayBuffer);
    for (let i = 0; i < buffer.length; ++i) {
        view[i] = buffer[i];
    }
    return arrayBuffer;
}

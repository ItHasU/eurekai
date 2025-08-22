import { asNamed } from "@dagda/shared/entities/named.types";
import { AppTypes } from "@eurekai/shared/src/entities";
import { ModelInfo } from "@eurekai/shared/src/models.api";
import { AbstractDiffuser, ImageDescription } from "../diffuser";

import { Client } from "@stable-canvas/comfyui-client";
import JSZip from "jszip";
import fs from "node:fs/promises";
import path from "node:path";
import { fetch } from "undici";
import { WebSocket } from "ws";

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
    /** Size ratio (eg 512, 1024) */
    size: number;
    /** Prompt template */
    promptTemplate: string;
}

export type Prompt = Record<string, unknown>;

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
            size: this._options.size
        };
    }

    /** @inheritdoc */
    public override async txt2img(image: ImageDescription): Promise<{ data: AppTypes["BASE64_DATA"] }> {
        // -- Generate image --
        const pool = ComfyUIDiffuser._getPool(this._options.serverURL);

        // -- Return image --
        const images = await pool.generate(this._options.promptTemplate, image);
        if (images == null || images.length === 0) {
            throw "No image generated";
        } else {
            return { data: asNamed(images[0]) };
        }
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

/** ComfyUIClient wrapper */
export class ComfyUIPool {

    protected _client: Client | null = null;

    constructor(protected _host: string) {
    }

    public async generate(template: string, params: ImageDescription): Promise<string[]> {
        // -- Prepare prompt --
        let promptStr = template;

        // Replace parameters in the format $param$
        for (const param in params) {
            const value = JSON.stringify(params[param as keyof ImageDescription] ?? null);
            const pattern = `$${param}$`;
            promptStr = promptStr.replaceAll(pattern, value);
        }
        const prompt: Prompt = JSON.parse(promptStr);

        // -- Connect --
        const client = new Client({
            api_host: this._host,
            api_base: "",
            sessionName: "",
            fetch,
            WebSocket
        });

        await client.connect();

        try {
            // -- Request images --
            const resp = await client.enqueue_polling(prompt);
            await client.waitForPrompt(resp.prompt_id);

            // -- Fetch images --
            const results: string[] = [];
            for (const image of resp.images) {
                switch (image.type) {
                    case "url": {
                        const resp = await fetch(image.data);
                        if (!resp.body) {
                            throw new Error("No body in response");
                        }
                        const buffer = await resp.arrayBuffer();
                        const buf = Buffer.from(buffer);
                        results.push(buf.toString("base64"));
                        break;
                    }
                    case "buff": {
                        const buf = Buffer.from(image.data);
                        results.push(buf.toString("base64"));
                        break;
                    }
                    default:
                        throw "Not implemented, ComfyUI return type";
                }
            }

            // -- Clean up --
            await client.deleteItem("history", resp.prompt_id);

            return results;
        } finally {
            await client.close();
        }
    }

}

//#endregion

//#region List all diffusers

/** Manifest description */
export interface Manifest {
    /** Short name displayed in the select */
    name: string;
    /** Size ratio (eg. 512, 1024) */
    size: number;
    /** Description */
    description?: string;
    /** Prompt filename (will use api.json by default) */
    filename?: string;
}

/** 
 * Try to wake up the ComfyUI server using WOL then get the list of all models.
 * You can use this function to make sure the server is up and running before trying to use it.
 * 
 * @return The list of diffusers
 * @throws An error if anything fails in the process
 */
export async function getAllComfyTemplatesWithWOL(comfyHost: string, comfyPath: string, wolScript?: string): Promise<ComfyUIDiffuser[]> {
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

            // -- Read prompt -------------------------------------------------
            const promptFilename = manifest.filename ?? "api.json";
            const promptTemplate = await zip.files[promptFilename].async("string");

            diffusers.push(new ComfyUIDiffuser({
                serverURL: comfyHost,
                wolScript,

                uid,
                name,
                size,
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
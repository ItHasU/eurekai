import { asNamed } from "@dagda/shared/entities/named.types";
import { AppTypes } from "@eurekai/shared/src/entities";
import { ModelInfo } from "@eurekai/shared/src/models.api";
import { AbstractDiffuser, ImageDescription } from "../diffuser";

import { Client } from "@stable-canvas/comfyui-client";
import JSZip from "jszip";
import fs from "node:fs/promises";
import path from "node:path";

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

    protected static readonly _connectionPool: Map<string, ComfyUIPool> = new Map();

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
        const options: Txt2ImgOptions = {
            ...this._options.template,
            prompt: image.prompt,
            negative_prompt: image.negative_prompt,
            width: image.width,
            height: image.height,
            seed: image.seed
        };

        // -- Return image --
        const images = await this._txt2img(options);
        if (images == null || images.length === 0) {
            throw "No image generated";
        } else {
            return { data: asNamed(images[0]) };
        }
    }

    //#endregion

    protected static _getPool(serverURL: string): ComfyUIPool {
        throw "Not implemented";
    }

}

//#endregion

//#region ComfyUI pool

/** ComfyUIClient wrapper */
export class ComfyUIPool {

    protected _client: Client | null = null;

    constructor(protected _url: string) { }

    public async generate(template: string, params: ImageDescription): Promise<string> {
        // -- Connect --
        const client = await this._getClient();

        // -- Prepare prompt --
        const prompt: Prompt = {};

        // -- Request images --
        const resp = await client.enqueue_polling(prompt);
        await client.waitForPrompt(resp.prompt_id);

        // -- Fetch images --
        let index: number = 0;
        for (const image of resp.images) {
            if (image.type === "url") {
                save_url_to_file(image.data, `./${index}.png`);
            }
        }
    }

    protected _getClient(): Promise<Client> {
        return Promise.reject("Not implemented");
    }
}

//#endregion

//#region List all diffusers

/** Manifest description */
export interface Manifest {
    /** UID */
    uid: string;
    /** Short name displayed in the select */
    name: string;
    /** Size ratio (eg. 512, 1024) */
    size: number;
    /** Description */
    description: string;
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
export async function getAllComfyTemplatesWithWOL(comfyURL: string, comfyPath: string, wolScript?: string): Promise<ComfyUIDiffuser[]> {
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
            const zip = await JSZip.loadAsync(zipFilePath);
            const manifestFile = zip.files["manifest.json"];
            if (manifestFile) {
                console.error(`Invalid zip file, no manifest.json : ${zipFilePath}`);
                continue;
            }

            // -- Read manifest -----------------------------------------------
            const manifestStr = await zip.files["manifest.json"].async("string");
            const manifest: Manifest = JSON.parse(manifestStr);
            const name = manifest.name;
            const size = manifest.size;
            const uid = manifest.uid;

            // -- Read prompt -------------------------------------------------
            const promptFilename = manifest.filename ?? "api.json";
            const promptTemplate = await zip.files[promptFilename].async("string");

            diffusers.push(new ComfyUIDiffuser({
                serverURL: comfyURL,
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
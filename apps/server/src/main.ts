import { getEnvNumber, getEnvString } from "@dagda/server/tools/config";
import { readFile } from "node:fs/promises";
import { DiffusersRegistry } from "./diffusers";
import { AbstractDiffuser, ImageDescription } from "./diffusers/diffuser";
import { ComfyUI } from "./diffusers/impl/comfyui";
import { ENV_VARIABLES_NUMBER, ENV_VARIABLES_STR } from "./modules/config";
import { initDatabaseHelper } from "./modules/db";
import { Generator } from "./modules/generator";
import { initHTTPServer } from "./modules/server";

async function main(): Promise<void> {
    // -- Initialize db -------------------------------------------------------
    const db = await initDatabaseHelper();

    // -- Initialize the models -----------------------------------------------
    try {
        await DiffusersRegistry.fetchAllModels();
    } catch (e) {
        console.error("Failed to fetch models, retry later manually");
    }

    const models = DiffusersRegistry.getModels();
    console.log(`${models.length} model(s)`);
    for (const model of models) {
        const info = model.getModelInfo();
        console.log(`- [${info.uid}] ${info.displayName}`);
    }

    // -- Generate ------------------------------------------------------------
    new Generator(db);

    // -- Initialize HTTP server ----------------------------------------------
    const baseURL = getEnvString<ENV_VARIABLES_STR>("BASE_URL");
    const port = getEnvNumber<ENV_VARIABLES_NUMBER>("PORT");
    await initHTTPServer(db, baseURL, port);

    console.log(`Server started, connect to ${baseURL}`);
}

async function testGenerator(): Promise<void> {
    console.log("Hello world!");
    const desc: ImageDescription = {
        width: 1024,
        height: 1024,
        prompt: "An astronaut riding an unicorn",
        negative_prompt: "NSFW",
        seed: 2
    };

    const workflowStr = (await readFile("/Users/matthieu/Downloads/workflow_api.json")).toString("utf-8");
    const generator: AbstractDiffuser = new ComfyUI("192.168.42.20:8188", "test", workflowStr);
    const img = await generator.txt2img(desc);
    console.log(img);
}

// main().catch(e => console.error(e));

testGenerator().catch(e => console.error(e));
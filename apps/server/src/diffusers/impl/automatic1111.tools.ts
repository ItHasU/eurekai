import { jsonGet } from "@dagda/server/tools/fetch";
import { wait } from "@dagda/shared/tools/async";
import { exec } from "child_process";
import { } from "node:process";
import { Automatic1111, SDModel } from "./automatic1111";
import { Flux } from "./flux";
import { SD } from "./sd";
import { SDXL } from "./sdxl";

async function getModels(apiUrl: string): Promise<SDModel[]> {
    const url = `${apiUrl}/sdapi/v1/sd-models`;
    return await jsonGet<SDModel[]>(url);
}
/** 
 * Try to wake up the Automatic1111 server using WOL then get the list of all models.
 * You can use this function to make sure the server is up and running before trying to use it.
 * 
 * @return The list of diffused on success
 * @throws An error if anything fails in the process
 */
export async function getAllModelsWithWOL(apiURL: string, wolScript?: string): Promise<Automatic1111[]> {
    // -- Read MAC address --
    const nbRetries: number = 3;
    const timeout_ms: number = 10000;

    // -- Check that the server is up --
    for (let i = 0; i < nbRetries; i++) {
        // -- Try to fetch the models --
        try {
            // If we managed to fetch the models, the server is up
            return await getAllModels(apiURL, wolScript);
        } catch (e) {
            // If we failed to fetch the models, the server is down
            console.error("Waiting for server to wake up...", e);
        }

        if (!wolScript) {
            // No WOL script, we can't wake the server
            return [];
        }

        // -- Send WOL request --
        try {
            // Execute the WOL script
            await new Promise<boolean>((resolve, reject) => {
                console.log(`Sending WOL request (attempt ${i + 1}/${nbRetries})...`);
                console.log(wolScript);
                exec(wolScript, (error: any) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(true);
                    }
                });
            });
            // -- Wait --
            await wait(timeout_ms);
        } catch (e) {
            console.error("Failed to send WOL request", e);
        }

    }
    // -- Failed to wake the server --
    throw new Error("Failed to wake the server after " + nbRetries + " retries");
}

/** Fetch models from Automatic 1111 and try to best guess all the available models */
export async function getAllModels(apiURL: string, wolScript?: string): Promise<Automatic1111[]> {
    // -- Fetch models and spread them --
    const sdxl_models: SDModel[] = [];
    const sd_models: SDModel[] = [];
    const flux_models: SDModel[] = [];

    const models = await getModels(apiURL);
    for (const model of models) {
        const name = model.title.toLocaleLowerCase();
        if (name.includes("flux")) {
            flux_models.push(model);
        } else if (name.includes("xl")) {
            sdxl_models.push(model);
        } else {
            sd_models.push(model);
        }
    }

    // -- Create all combinaision of models --
    const diffusers: Automatic1111[] = [];
    for (const flux_model of flux_models) {
        diffusers.push(new Flux(apiURL, flux_model, wolScript));
    }
    for (const sdxl_model of sdxl_models) {
        diffusers.push(new SDXL(apiURL, sdxl_model, wolScript));
    }
    for (const sd_model of sd_models) {
        diffusers.push(new SD(apiURL, sd_model, wolScript));
    }
    return diffusers;
}
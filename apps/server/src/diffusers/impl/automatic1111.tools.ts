import { jsonGet } from "@dagda/server/tools/fetch";
import { AbstractDiffuser } from "../diffuser";
import { SDModel } from "./automatic1111";
import { SD } from "./sd";
import { SDXL } from "./sdxl";

async function getModels(apiUrl: string): Promise<SDModel[]> {
    const url = `${apiUrl}/sdapi/v1/sd-models`;
    return await jsonGet<SDModel[]>(url);
}

/** Fetch models from Automatic 1111 and try to best guess all the available models */
export async function getAllModels(apiURL: string): Promise<AbstractDiffuser[]> {
    // -- Fetch models and spread them --
    const sdxl_refiners: SDModel[] = [];
    const sdxl_models: SDModel[] = [];
    const sd_models: SDModel[] = [];

    const models = await getModels(apiURL);
    for (const model of models) {
        const name = model.title.toLocaleLowerCase();
        if (name.includes("refiner")) {
            sdxl_refiners.push(model);
        } else if (name.includes("xl")) {
            sdxl_models.push(model);
        } else {
            sd_models.push(model);
        }
    }

    // -- Create all combinaision of models --
    const diffusers: AbstractDiffuser[] = [];
    for (const sdxl_model of sdxl_models) {
        for (const sdxl_refiner of sdxl_refiners) {
            diffusers.push(new SDXL(apiURL, sdxl_model.title, sdxl_refiner.title));
        }
    }
    for (const sd_model of sd_models) {
        diffusers.push(new SD(apiURL, sd_model.title));
    }
    return diffusers;
}
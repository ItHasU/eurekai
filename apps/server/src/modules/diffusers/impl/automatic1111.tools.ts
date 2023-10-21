import { DatabaseWrapper } from "src/modules/db";
import { Automatic1111, SDModel } from "./automatic1111";
import { SDXL } from "./sdxl";
import { SD } from "./sd";

/** Fetch models from Automatic 1111 and try to best guess all the available models */
export async function registerAllModels(db: DatabaseWrapper, apiURL: string): Promise<void> {
    // -- Clear models --
    db.clearModels();

    // -- Fetch models and spread them --
    const sdxl_refiners: SDModel[] = [];
    const sdxl_models: SDModel[] = [];
    const sd_models: SDModel[] = [];

    const models = await Automatic1111.getModels(apiURL);
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
    for (const sdxl_model of sdxl_models) {
        for (const sdxl_refiner of sdxl_refiners) {
            db.registerModel(`SDXL ${sdxl_model.model_name} + ${sdxl_refiner.model_name}`, new SDXL(apiURL, sdxl_model.title, sdxl_refiner.title));
        }
    }
    for (const sd_model of sd_models) {
        db.registerModel(`SD ${sd_model.model_name}`, new SD(apiURL, sd_model.title));
    }
}
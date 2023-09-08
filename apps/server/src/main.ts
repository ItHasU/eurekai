import { getEnvNumber, getEnvString } from "./modules/config";
import { DatabaseWrapper } from "./modules/db";
import { SD } from "./modules/diffusers/impl/sd";
import { SDXL } from "./modules/diffusers/impl/sdxl";
import { Generator } from "./modules/generator";
import { AppServer } from "./modules/server";

async function main(): Promise<void> {
    const apiURL = getEnvString("API_URL");

    const db = new DatabaseWrapper("eurekai.db");
    db.registerModel("Deliberate 2", new SD(apiURL, "deliberate_v2.safetensors [9aba26abdf]"));
    db.registerModel("Dream Shaper 8", new SD(apiURL, "dreamshaper_8.safetensors [879db523c3]"));
    db.registerModel("SDXL 1.0", new SDXL(apiURL, "sd_xl_base_1.0_0.9vae.safetensors [e6bb9ea85b]", "sd_xl_refiner_1.0_0.9vae.safetensors [8d0ce6c016]"));

    await db.initIfNeeded();
    await db.fixComputingAtStart();

    new AppServer({
        data: db,
        port: getEnvNumber("PORT")
    });

    // Start the generator
    new Generator(db);
}

main().catch(e => console.error(e));
import { getEnvNumber, getEnvString } from "./modules/config";
import { GeneratorHandler } from "./modules/generatorHandler";
import { AppServer } from "./modules/server";

const app = new AppServer({
    port: getEnvNumber("PORT")
});

// Start the generator
new GeneratorHandler(app.dbConstructor, getEnvString("API_URL"));

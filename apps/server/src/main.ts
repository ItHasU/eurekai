import { GeneratorHandler } from "./modules/generatorHandler";
import { AppServer } from "./modules/server";

const apiUrl = "http://192.168.42.20:7860";
// const apiUrl = "http://127.0.0.1:7860";

const app = new AppServer({
    port: 3000
});

// Start the generator
new GeneratorHandler(app.dbConstructor, apiUrl);
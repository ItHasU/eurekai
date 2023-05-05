import { getEnvNumber, getEnvString } from "./modules/config";
import { DatabaseWrapper } from "./modules/db";
import { GeneratorHandler } from "./modules/generatorHandler";
import { AppServer } from "./modules/server";

// const app = new AppServer({
//     port: getEnvNumber("PORT")
// });

// // Start the generator
// new GeneratorHandler(app.dbConstructor, getEnvString("API_URL"));

async function main(): Promise<void> {
    const db = new DatabaseWrapper("eurekai.db");
    await db.initIfNeeded();

    await db.addProject("test");
    const projects = await db.getProjects();
    console.log(JSON.stringify(projects));

    await db.close();
}

main().catch(e => console.error(e));
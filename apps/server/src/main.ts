import { ComputationStatus, PictureDTO } from "@eurekai/shared/src/types";
import { getEnvNumber, getEnvString } from "./modules/config";
import { DatabaseWrapper } from "./modules/db";
import { Generator } from "./modules/generator";
import { fstat, writeFileSync } from "fs";

// const app = new AppServer({
//     port: getEnvNumber("PORT")
// });


async function main(): Promise<void> {
    const db = new DatabaseWrapper(":memory:");
    await db.initIfNeeded();

    const projectId = await db.addProject("test");

    const projects = await db.getProjects();
    console.log(JSON.stringify(projects));

    // Start the generator
    const generator = new Generator(db, getEnvString("API_URL"));

    await db.addPrompt({
        projectId,
        index: 1,
        active: true,
        prompt: "test",
        bufferSize: 1,
        acceptedTarget: 1
    });

    let pictures: PictureDTO[] = [];
    do {
        pictures = await db.getPictures(projectId);

        await new Promise(resolve => setTimeout(resolve, 1000));
    } while (pictures.length === 0 || pictures[0].computed !== ComputationStatus.DONE);

    for (const picture of pictures) {
        if (picture.attachmentId) {
            const data = await db.getAttachment(picture.attachmentId);
            writeFileSync(`./${picture.projectId}_${picture.id}.png`, data, { encoding: "base64" });
        }
    }

    //await db.close();
    generator.stop();
}

main().catch(e => console.error(e));
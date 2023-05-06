import { ComputationStatus, PictureDTO } from "@eurekai/shared/src/types";
import { zipPictures } from "@eurekai/shared/src/utils";
import { getEnvNumber, getEnvString } from "./modules/config";
import { DatabaseWrapper } from "./modules/db";
import { Generator } from "./modules/generator";
import { writeFileSync } from "fs";
import { AppServer } from "./modules/server";

async function main(): Promise<void> {
    const db = new DatabaseWrapper("test.db");
    await db.initIfNeeded();

    const app = new AppServer({
        data: db,
        port: getEnvNumber("PORT")
    });
}

main().catch(e => console.error(e));



    // const projectId = await db.addProject("test");

    // const projects = await db.getProjects();
    // console.log(JSON.stringify(projects));

    // // Start the generator
    // const generator = new Generator(db, getEnvString("API_URL"));

    // await db.addPrompt({
    //     projectId,
    //     index: 1,
    //     active: true,
    //     prompt: "test",
    //     bufferSize: 1,
    //     acceptedTarget: 1
    // });

    // let pictures: PictureDTO[] = [];
    // do {
    //     pictures = await db.getPictures(projectId);

    //     await new Promise(resolve => setTimeout(resolve, 1000));
    // } while (pictures.length === 0 || pictures[0].computed !== ComputationStatus.DONE);

    // for (const picture of pictures) {
    //     if (picture.attachmentId) {
    //         const data = await db.getAttachment(picture.attachmentId);
    //         writeFileSync(`./${picture.projectId}_${picture.id}.png`, data, { encoding: "base64" });
    //     }
    // }
    // // Write a zip to disk
    // const zip = await zipPictures({ data: db, projectId });
    // const zipData = await zip.generateAsync({ type: "nodebuffer" });
    // writeFileSync(`./${projectId}.zip`, zipData);

    // generator.stop();
    // setTimeout(() => {
    //     // Wait for the generator to stopn then exit
    //     db.close();
    // }, 2000);

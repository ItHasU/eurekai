import { ServerDBConnector } from "./modules/serverDB";
import { AppServer } from "./modules/server";

const apiUrl = "http://192.168.42.20:7860";

const app = new AppServer({
    port: 3000
});

const db = new ServerDBConnector(app.dbConstructor, apiUrl);
// setInterval(async () => {
//     const images = await db.getImages();
//     console.log(images.length, images);
// }, 5000);
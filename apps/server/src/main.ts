import { ServerDBConnector } from "./modules/serverDB";
import { AppServer } from "./modules/server";

const apiUrl = "http://127.0.0.1:7860";

const app = new AppServer({
    port: 3000
});

const db = new ServerDBConnector(app.dbConstructor, apiUrl);
setInterval(async () => {
    const images = await db.getImages();
    console.log(images.length, images);
}, 5000);
import { ServerDBConnector } from "./modules/serverDB";
import { init } from "./modules/server";

const apiUrl = "http://localhost:7860/";

const app = init({
    port: 5001
});
const db = new ServerDBConnector(apiUrl);

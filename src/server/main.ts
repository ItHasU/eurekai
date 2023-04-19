import { init } from "./modules/server";
import PouchDB from "pouchdb";

const app = init({
    port: 5001
});

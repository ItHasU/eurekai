import "bootstrap/dist/css/bootstrap.css";
import "bootstrap/dist/js/bootstrap.js";
import "bootstrap-icons/font/bootstrap-icons.css";

import { ClientPromptManager } from "./managers/client.prompt.manager";
import { ClientPictureManager } from "./managers/client.picture.manager";
import PouchDB from "pouchdb";
import { PromptsWrapper } from "@eurekai/shared/src/prompts.wrapper";
import { PicturesWrapper } from "@eurekai/shared/src/pictures.wrapper";

class App {
    protected readonly _prompts: PromptsWrapper;
    protected readonly _pictures: PicturesWrapper;

    protected readonly _promptsTab: ClientPromptManager;
    protected readonly _picturesTab: ClientPictureManager;

    constructor() {
        this._prompts = new PromptsWrapper(PouchDB);
        this._prompts.setSync(document.location.href + "db/prompts/");
        this._pictures = new PicturesWrapper(PouchDB);
        this._pictures.setSync(document.location.href + "db/pictures/");

        this._promptsTab = new ClientPromptManager(this._prompts);
        this._picturesTab = new ClientPictureManager(this._prompts, this._pictures);
    }

}

const APP: App = new App();

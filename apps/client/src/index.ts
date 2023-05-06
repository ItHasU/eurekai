import "bootstrap/dist/css/bootstrap.css";
import "bootstrap/dist/js/bootstrap.js";
import "bootstrap-icons/font/bootstrap-icons.css";

import "./pages/projects.page";

// import { ClientPromptManager } from "./managers/client.prompt.manager";
// import { ClientPictureManager } from "./managers/client.picture.manager";
import { API } from "./api";
import { ProjectsPage } from "./pages/projects.page";

class App {

    protected readonly _api: API = new API();

    protected readonly _projectsTab: ProjectsPage = new ProjectsPage(this._api);

    // protected readonly _promptsTab: ClientPromptManager;
    // protected readonly _picturesTab: ClientPictureManager;

    constructor() {
        // this._prompts = new PromptsWrapper(PouchDB);
        // this._prompts.setSync(document.location.href + "db/prompts/");
        // this._pictures = new PicturesWrapper(PouchDB);
        // this._pictures.setSync(document.location.href + "db/pictures/");

        // this._promptsTab = new ClientPromptManager(this._prompts);
        // this._picturesTab = new ClientPictureManager(this._prompts, this._pictures);
        document.getElementById("projects-tab-pane")?.appendChild(this._projectsTab);
    }

}

const APP: App = new App();

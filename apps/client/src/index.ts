import "bootstrap/dist/css/bootstrap.css";
import "bootstrap/dist/js/bootstrap.js";
import "bootstrap-icons/font/bootstrap-icons.css";

import "./pages/projects.page";

// import { ClientPromptManager } from "./managers/client.prompt.manager";
// import { ClientPictureManager } from "./managers/client.picture.manager";
import { API } from "./api";
import { ProjectsPage } from "./pages/projects.page";
import { PromptsPage } from "./pages/prompts.page";
import { PicturesPage } from "./pages/pictures.page";

class App {

    protected readonly _api: API = new API();

    protected readonly _projectsTab: ProjectsPage = new ProjectsPage(this._api);
    protected readonly _promptsTab: PromptsPage = new PromptsPage(this._api);
    protected readonly _picturesTab: PicturesPage = new PicturesPage(this._api);

    constructor() {
        document.getElementById("projects-tab-pane")?.appendChild(this._projectsTab);
        document.getElementById("prompts-tab-pane")?.appendChild(this._promptsTab);
        document.getElementById("pictures-tab-pane")?.appendChild(this._picturesTab);

        // -- Bind callbacks --
        this._projectsTab.addEventListener("project-change", this._onProjectSelected.bind(this));
    }

    protected _onProjectSelected(event: Event): void {
        const projectId = (event as CustomEvent<number>).detail;
        this._promptsTab.setProjectId(projectId).catch(console.error.bind(console));
        this._picturesTab.setProjectId(projectId).catch(console.error.bind(console));
    }
}

const APP: App = new App();

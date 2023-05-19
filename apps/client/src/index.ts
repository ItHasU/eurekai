import "bootstrap/dist/css/bootstrap.css";
import "bootstrap/dist/js/bootstrap.js";
import "bootstrap-icons/font/bootstrap-icons.css";

import "./pages/projects.page";

import { API } from "./api";
import { ProjectsPage } from "./pages/projects.page";
import { PromptsPage } from "./pages/prompts.page";
import { PicturesPage } from "./pages/pictures.page";
import { DataCache } from "@eurekai/shared/src/cache";
import { AbstractPageElement } from "./pages/abstract.page.element";
import { EditPage } from "./pages/edit.page";
import { SettingsPage } from "./pages/settings.page";

interface PageConstructor {
    new(cache: DataCache): AbstractPageElement;
}

class App {

    protected readonly _api: API = new API();
    protected readonly _cache: DataCache = new DataCache(this._api);

    protected readonly _pageDiv: HTMLDivElement;
    protected _currentPage: AbstractPageElement | null = null;

    constructor() {
        // -- Bind refresh button --
        const refreshButton = document.getElementById("refreshButton");
        if (refreshButton) {
            refreshButton.addEventListener("click", async () => {
                console.debug("Refresh button clicked");
                this._cache.markDirty();
                if (this._currentPage) {
                    await this._currentPage.refresh();
                }
            });
        }
        // -- Bind pages --
        this._pageDiv = document.getElementById("pageDiv") as HTMLDivElement;
        this._bindPage("editButton", EditPage);
        this._bindPage("projectsButton", ProjectsPage);
        this._bindPage("promptsButton", PromptsPage);
        this._bindPage("picturesButton", PicturesPage);
        this._bindPage("settingsButton", SettingsPage);

        this._setPage(ProjectsPage);
    }

    protected _bindPage(buttonId: string, pageConstructor: PageConstructor): void {
        const button = document.getElementById(buttonId);
        if (button) {
            button.addEventListener("click", this._setPage.bind(this, pageConstructor));
        } else {
            console.error(`Button ${buttonId} not found, cannot bind page`);
        }
    }

    protected _setPage(pageConstructor: PageConstructor): void {
        // -- Empty page --
        this._pageDiv.innerHTML = "";
        // -- Create page --
        this._currentPage = new pageConstructor(this._cache);
        this._pageDiv.appendChild(this._currentPage);
        this._currentPage.refresh(); // Catched by the page
    }
}

const APP: App = new App();

import "bootstrap";
import "bootstrap-icons/font/bootstrap-icons.css";
import "bootstrap/dist/css/bootstrap.css";

import { SQLStatusComponent } from "@dagda/client/sql/status.component";
import { ClientNotificationImpl } from "@dagda/client/tools/notification.impl";
import { NotificationHelper } from "@dagda/shared/tools/notification.helper";
import { AppEvents } from "@eurekai/shared/src/events";
import { PictureElement } from "./components/picture.element";
import { PromptElement } from "./components/prompt.element";
import { PromptEditor } from "./editors/prompt.editor";
import { AbstractPageElement } from "./pages/abstract.page.element";
import { MaintenancePage } from "./pages/maintenance.page";
import { PicturesPage } from "./pages/pictures.page";
import { ProjectsPage } from "./pages/projects.page";
import { StaticDataProvider } from "./tools/dataProvider";

interface PageConstructor {
    new(): AbstractPageElement;
}

// -- Make sure components are loaded --
ProjectsPage;
PicturesPage;
MaintenancePage;

PromptElement;
PictureElement;

PromptEditor;

class App {

    protected readonly _pageDiv: HTMLDivElement;
    protected readonly _statusPlaceholder: HTMLSpanElement;

    protected _currentPage: AbstractPageElement | null = null;

    protected _lastRefreshed: DOMHighResTimeStamp | null = null;

    constructor() {
        // -- SQLHandler --
        this._statusPlaceholder = document.getElementById("statusPlaceholder") as HTMLSpanElement;
        this._statusPlaceholder.append(new SQLStatusComponent(StaticDataProvider.entitiesHandler));
        this._statusPlaceholder.addEventListener("click", async () => {
            StaticDataProvider.entitiesHandler.markCacheDirty();
            if (this._currentPage) {
                await this._currentPage.refresh();
            }
        });

        // -- Bind lock button --
        const lockButton = document.getElementById("lockButton");
        if (lockButton) {
            lockButton.addEventListener("click", () => this._toggleLocked());
        }
        // -- Bind pages --
        this._pageDiv = document.getElementById("pageDiv") as HTMLDivElement;
        this._bindPage("projectsButton", ProjectsPage);
        this._bindPage("maintenanceButton", MaintenancePage);

        this.setPage(ProjectsPage);

        // -- Auto-lock on inactivity --
        // Wait for next frame animation and if delta is > to 5 seconds, lock
        const step = (timestamp: DOMHighResTimeStamp) => {
            if (this._lastRefreshed == null || (timestamp - this._lastRefreshed) > 5000) {
                this._toggleLocked(true);
            }
            this._lastRefreshed = timestamp;
            window.requestAnimationFrame(step);
        }
        window.requestAnimationFrame(step);

        // -- Notification helper --
        NotificationHelper.set(new ClientNotificationImpl());

        // -- Generation display --
        const generationSpan = document.getElementById("generationSpan");
        const generationCount = document.getElementById("generationCount");
        if (generationSpan && generationCount) {
            NotificationHelper.on<AppEvents>("generating", (event) => {
                generationSpan.classList.toggle("d-none", event.data.count === 0);
                generationCount.innerText = "" + event.data.count;
            });
        }

        // -- Service worker --
        this._installServiceWorker();
    }

    protected _bindPage(buttonId: string, pageConstructor: PageConstructor): void {
        const button = document.getElementById(buttonId);
        if (button) {
            button.addEventListener("click", this.setPage.bind(this, pageConstructor));
        } else {
            console.error(`Button ${buttonId} not found, cannot bind page`);
        }
    }

    public setPage(pageConstructor: PageConstructor): void {
        // -- Empty page --
        this._pageDiv.innerHTML = "";
        // -- Create page --
        this._currentPage = new pageConstructor();
        this._pageDiv.appendChild(this._currentPage);
        this._currentPage.refresh(); // Catched by the page
    }

    public refresh(): void {
        this._currentPage?.refresh();
    }

    protected _toggleLocked(locked?: boolean): void {
        document.body.classList.toggle("locked", locked);
    }

    protected _installServiceWorker(): void {
        Promise.resolve().then(async () => {
            try {
                await navigator.serviceWorker.register("/sw/main.js", { scope: "/sw/" });
            } catch (e) {
                console.error("Failed to register service worker", e);
            }
        });
    }
}

/** Singleton of the App */
export const APP: App = new App();

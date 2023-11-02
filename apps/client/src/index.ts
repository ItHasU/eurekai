import "bootstrap";
import "bootstrap-icons/font/bootstrap-icons.css";
import "bootstrap/dist/css/bootstrap.css";

import { SQLHandler } from "@dagda/shared/sql/handler";
import { Filters, Tables, filterEquals } from "@eurekai/shared/src/types";
import { PromptEditor } from "./editors/prompt.editor";
import { AbstractPageElement, DataProvider } from "./pages/abstract.page.element";
import { ProjectsPage } from "./pages/projects.page";

// import { Notification, NotificationKind } from "@eurekai/shared/src/data";
import { PictureElement } from "./components/picture.element";
import { PromptElement } from "./components/prompt.element";
import { PicturesPage } from "./pages/pictures.page";
// import { SettingsPage } from "./pages/settings.page";
import { generateFetchFunction, generateSubmitFunction } from "@dagda/client/sql/client.adapter";
import { SQLStatusComponent } from "@dagda/client/sql/status.component";

interface PageConstructor {
    new(data: DataProvider): AbstractPageElement;
}

// -- Make sure components are loaded --
ProjectsPage;
PicturesPage;

PromptElement;
PictureElement;

PromptEditor;

class App implements DataProvider {

    protected _sqlHandler: SQLHandler<Tables, Filters>;

    protected readonly _pageDiv: HTMLDivElement;
    protected readonly _statusPlaceholder: HTMLSpanElement;

    protected _currentPage: AbstractPageElement | null = null;
    protected _selectedProjectId: number | undefined = undefined;

    protected _lastRefreshed: DOMHighResTimeStamp | null = null;

    constructor() {
        // -- SQLHandler --
        this._sqlHandler = new SQLHandler({
            filterEquals: filterEquals,
            fetch: generateFetchFunction(),
            submit: generateSubmitFunction()
        });
        this._statusPlaceholder = document.getElementById("statusPlaceholder") as HTMLSpanElement;
        this._statusPlaceholder.append(new SQLStatusComponent(this._sqlHandler));

        // -- Bind refresh button --
        const refreshButton = document.getElementById("refreshButton");
        if (refreshButton) {
            refreshButton.addEventListener("click", async () => {
                console.debug("Refresh button clicked");
                // this._cache.clearNotifications();
                this._sqlHandler.markCacheDirty();
                if (this._currentPage) {
                    await this._currentPage.refresh();
                }
            });
        }
        // -- Bind lock button --
        const lockButton = document.getElementById("lockButton");
        if (lockButton) {
            lockButton.addEventListener("click", () => this._toggleLocked());
        }
        // -- Bind pages --
        this._pageDiv = document.getElementById("pageDiv") as HTMLDivElement;
        this._bindPage("projectsButton", ProjectsPage);
        // this._bindPage("settingsButton", SettingsPage);

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
    }

    //#region DataProvider ----------------------------------------------------

    public getSQLHandler(): SQLHandler<Tables, Filters> {
        return this._sqlHandler;
    }

    public getSelectedProject(): number | undefined {
        return this._selectedProjectId;
    }

    public setSelectedProject(projectId: number | undefined): void {
        this._selectedProjectId = projectId;
        this.setPage(PicturesPage);
    }

    //#endregion

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
        this._currentPage = new pageConstructor(this);
        this._pageDiv.appendChild(this._currentPage);
        this._currentPage.refresh(); // Catched by the page
    }

    protected _toggleLocked(locked?: boolean): void {
        document.body.classList.toggle("locked", locked);
    }

    // protected _refreshNotificationsCount(notifications: Notification[]): void {
    //     const notificationCountSpan = document.getElementById("notificationCountSpan");
    //     if (notificationCountSpan == null) {
    //         return;
    //     }

    //     let newCount = 0;
    //     let newHighresCount = 0;
    //     let errorsCount = 0;
    //     let unknownCount = 0;
    //     for (const notification of notifications) {
    //         switch (notification.kind) {
    //             case NotificationKind.IMAGE_NEW:
    //                 newCount++;
    //                 break;
    //             case NotificationKind.IMAGE_NEW_HIGHRES:
    //                 newHighresCount++;
    //                 break;
    //             case NotificationKind.IMAGE_ERROR:
    //                 errorsCount++;
    //                 break;
    //             default:
    //                 unknownCount++;
    //                 break;
    //         }
    //     }

    //     notificationCountSpan.classList.remove("bg-danger", "bg-secondary", "bg-success");
    //     if (errorsCount > 0) {
    //         notificationCountSpan.innerText = "" + errorsCount;
    //         notificationCountSpan.classList.add("bg-primary");
    //     } else if (newCount > 0 || newHighresCount > 0) {
    //         notificationCountSpan.innerText = `${newCount}+${newHighresCount}`;
    //         notificationCountSpan.classList.add("bg-success");
    //     } else if (unknownCount > 0) {
    //         notificationCountSpan.innerText = "" + unknownCount;
    //         notificationCountSpan.classList.add("bg-secondary");
    //     } else {
    //         notificationCountSpan.innerText = "-";
    //         notificationCountSpan.classList.add("bg-secondary");
    //     }
    // }
}

/** Singleton of the App */
export const APP: App = new App();

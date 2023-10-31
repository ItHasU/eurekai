import "bootstrap";
import "bootstrap-icons/font/bootstrap-icons.css";
import "bootstrap/dist/css/bootstrap.css";

// import { Notification, NotificationKind } from "@eurekai/shared/src/data";
// import { PictureElement } from "./components/picture.element";
// import { PromptElement } from "./components/prompt.element";
import { PromptEditor } from "./editors/prompt.editor";
import { AbstractPageElement, DataProvider } from "./pages/abstract.page.element";
// import { PicturesPage } from "./pages/pictures.page";
import { SQLHandler } from "@dagda/sql-shared/src/sql.handler";
import { APP_FOREIGN_KEYS, Tables } from "@eurekai/shared/src/types";
import { ProjectsPage } from "./pages/projects.page";
// import { SettingsPage } from "./pages/settings.page";
import { SQLClientConnector } from "@dagda/sql-proxy-client/src/client.connector";

interface PageConstructor {
    new(data: DataProvider): AbstractPageElement;
}

// -- Make sure components are loaded --
ProjectsPage;
// PicturesPage;

// PromptElement;
// PromptElement;
// PictureElement;

PromptEditor;


class App implements DataProvider {

    protected _sqlConnector: SQLClientConnector<Tables>;
    protected _sqlHandler: SQLHandler<Tables>;

    protected readonly _pageDiv: HTMLDivElement;
    protected _currentPage: AbstractPageElement | null = null;

    protected _lastRefreshed: DOMHighResTimeStamp | null = null;

    constructor() {
        this._sqlConnector = new SQLClientConnector<Tables>(APP_FOREIGN_KEYS);
        this._sqlHandler = new SQLHandler(this._sqlConnector);

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

    public getSQLHandler(): SQLHandler<Tables> {
        return this._sqlHandler;
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

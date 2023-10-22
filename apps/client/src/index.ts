import "bootstrap/dist/css/bootstrap.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "bootstrap";

import { API } from "./api";
import { ProjectsPage } from "./pages/projects.page";
import { DataCache } from "@eurekai/shared/src/cache";
import { AbstractPageElement } from "./pages/abstract.page.element";
import { SettingsPage } from "./pages/settings.page";
import { Notification, NotificationKind } from "@eurekai/shared/src/data";
import { PromptEditor } from "./editors/prompt.editor";
import { PicturesPage } from "./pages/pictures.page";
import { PromptElement } from "./components/prompt.element";
import { PictureElement } from "./components/picture.element";

interface PageConstructor {
    new(cache: DataCache): AbstractPageElement;
}

// -- Make sure components are loaded --
ProjectsPage;
PicturesPage;

PromptElement;
PromptElement;
PictureElement;

PromptEditor;


class App {
    protected readonly _api: API = new API();
    protected readonly _cache: DataCache = new DataCache(this._api);

    protected readonly _pageDiv: HTMLDivElement;
    protected _currentPage: AbstractPageElement | null = null;

    protected _lastRefreshed: DOMHighResTimeStamp | null = null;

    constructor() {
        // -- Bind notifications --
        this._api.notificationCallback = (api: API, notification: Notification) => {
            this._cache.pushNotification(notification);
        };
        this._cache.notificationCallback = (data: DataCache, notifications: Notification[]) => {
            this._refreshNotificationsCount(notifications);
        };

        // -- Bind refresh button --
        const refreshButton = document.getElementById("refreshButton");
        if (refreshButton) {
            refreshButton.addEventListener("click", async () => {
                console.debug("Refresh button clicked");
                this._cache.clearNotifications();
                this._cache.markDirty();
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
        this._bindPage("settingsButton", SettingsPage);

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
        this._currentPage = new pageConstructor(this._cache);
        this._pageDiv.appendChild(this._currentPage);
        this._currentPage.refresh(); // Catched by the page
    }

    protected _toggleLocked(locked?: boolean): void {
        document.body.classList.toggle("locked", locked);
    }

    protected _refreshNotificationsCount(notifications: Notification[]): void {
        const notificationCountSpan = document.getElementById("notificationCountSpan");
        if (notificationCountSpan == null) {
            return;
        }

        let newCount = 0;
        let newHighresCount = 0;
        let errorsCount = 0;
        let unknownCount = 0;
        for (const notification of notifications) {
            switch (notification.kind) {
                case NotificationKind.IMAGE_NEW:
                    newCount++;
                    break;
                case NotificationKind.IMAGE_NEW_HIGHRES:
                    newHighresCount++;
                    break;
                case NotificationKind.IMAGE_ERROR:
                    errorsCount++;
                    break;
                default:
                    unknownCount++;
                    break;
            }
        }

        notificationCountSpan.classList.remove("bg-danger", "bg-secondary", "bg-success");
        if (errorsCount > 0) {
            notificationCountSpan.innerText = "" + errorsCount;
            notificationCountSpan.classList.add("bg-primary");
        } else if (newCount > 0 || newHighresCount > 0) {
            notificationCountSpan.innerText = `${newCount}+${newHighresCount}`;
            notificationCountSpan.classList.add("bg-success");
        } else if (unknownCount > 0) {
            notificationCountSpan.innerText = "" + unknownCount;
            notificationCountSpan.classList.add("bg-secondary");
        } else {
            notificationCountSpan.innerText = "-";
            notificationCountSpan.classList.add("bg-secondary");
        }
    }
}

/** Singleton of the App */
export const APP: App = new App();

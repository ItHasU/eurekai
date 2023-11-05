import "bootstrap";
import "bootstrap-icons/font/bootstrap-icons.css";
import "bootstrap/dist/css/bootstrap.css";

import { SQLStatusComponent } from "@dagda/client/sql/status.component";
import { PictureElement } from "./components/picture.element";
import { PromptElement } from "./components/prompt.element";
import { PromptEditor } from "./editors/prompt.editor";
import { AbstractPageElement } from "./pages/abstract.page.element";
import { PicturesPage } from "./pages/pictures.page";
import { ProjectsPage } from "./pages/projects.page";
import { StaticDataProvider } from "./tools/dataProvider";

interface PageConstructor {
    new(): AbstractPageElement;
}

// -- Make sure components are loaded --
ProjectsPage;
PicturesPage;

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
        this._statusPlaceholder.append(new SQLStatusComponent(StaticDataProvider.sqlHandler));
        this._statusPlaceholder.addEventListener("click", async () => {
            StaticDataProvider.sqlHandler.markCacheDirty();
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
        this._currentPage = new pageConstructor();
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

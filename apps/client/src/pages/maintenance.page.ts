import { apiCall } from "@dagda/client/api";
import { SYSTEM_URL, SystemAPI } from "@eurekai/shared/src/system.api";
import { showNotificationIfPossible } from "src/tools/notification";
import { AbstractPageElement } from "./abstract.page.element";

/** Display projects and fire an event on project change */
export class MaintenancePage extends AbstractPageElement {

    protected readonly _startedAtInput: HTMLInputElement;
    protected readonly _uptimeInput: HTMLInputElement;
    protected readonly _errorPre: HTMLPreElement;
    protected readonly _errorButton: HTMLButtonElement;
    protected readonly _notificationButton: HTMLButtonElement;

    constructor() {
        super(require("./maintenance.page.html").default);

        // -- Get components --
        this._startedAtInput = this.querySelector("#startedAtInput") as HTMLInputElement;
        this._uptimeInput = this.querySelector("#uptimeInput") as HTMLInputElement;
        this._errorPre = this.querySelector("#errorPre") as HTMLPreElement;
        this._errorButton = this.querySelector("#errorButton") as HTMLButtonElement;
        this._notificationButton = this.querySelector("#notificationButton") as HTMLButtonElement;

        this._errorButton.addEventListener("click", async () => {
            try {
                console.log("Triggering an error");
                await apiCall<SystemAPI<void>, "triggerError">(SYSTEM_URL, "triggerError");
            } catch (e) {
                console.error(e);
            } finally {
                this.refresh();
            }
        });

        this._notificationButton.addEventListener("click", async () => {
            try {
                // -- Request permission --
                const permission: NotificationPermission = await Notification.requestPermission();
                this._refresh_notificationButton(permission);

                // -- Trigger a sample notification --
                showNotificationIfPossible({
                    body: "If you see this, notifications are set up correctly"
                });
            } catch (e) {
                console.error(e);
            }
        });
    }

    /** @inheritdoc */
    protected override async _refresh(): Promise<void> {
        const info = await apiCall<SystemAPI<void>, "getSystemInfo">(SYSTEM_URL, "getSystemInfo");

        this._startedAtInput.value = new Date(info.startTimeMilliseconds).toLocaleString();
        this._uptimeInput.value = secondsToHms(Math.floor((new Date().getTime() - info.startTimeMilliseconds) / 1000));

        this._errorPre.innerText = info.errors.length === 0 ? "-----" : info.errors.join("\n\n-----\n\n");

        this._refresh_notificationButton();
    }

    /** Refresh notification button based on current permission */
    protected _refresh_notificationButton(permission?: NotificationPermission): void {
        if (permission == null) {
            permission = Notification.permission;
        }

        this._notificationButton.classList.remove(
            "btn-outline-secondary",
            "btn-danger",
            "btn-success"
        );
        switch (permission) {
            case "denied":
                this._notificationButton.classList.add("btn-danger");
                break;
            case "default":
                this._notificationButton.classList.add("btn-outline-secondary");
                break;
            case "granted":
                this._notificationButton.classList.add("btn-success");
                break;
        }
    }
}

function secondsToHms(seconds: number) {
    let d = Math.floor(seconds / (24 * 3600));
    let h = Math.floor(seconds / 3600) % 24;
    let m = Math.floor((seconds % 3600) / 60);
    let s = Math.floor(seconds) % 60;

    // Ajoute des zéros si nécessaire
    const hh = h < 10 ? '0' + h : h;
    const mm = m < 10 ? '0' + m : m;
    const ss = s < 10 ? '0' + s : s;

    return `${d}d ${hh}:${mm}:${ss}`;
}


customElements.define("maintenance-page", MaintenancePage);
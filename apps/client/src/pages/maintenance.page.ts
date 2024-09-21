import { apiCall } from "@dagda/client/api";
import { SYSTEM_URL, SystemAPI } from "@eurekai/shared/src/system.api";
import { StaticDataProvider } from "src/tools/dataProvider";
import { AbstractPageElement } from "./abstract.page.element";

/** Display projects and fire an event on project change */
export class MaintenancePage extends AbstractPageElement {

    protected readonly _uptimeSpan: HTMLInputElement;

    constructor() {
        super(require("./maintenance.page.html").default);

        // -- Get components --
        this._uptimeSpan = this.querySelector("#uptimeInput") as HTMLInputElement;
    }

    /** @inheritdoc */
    public override async _refresh(): Promise<void> {
        await StaticDataProvider.entitiesHandler.fetch({ type: "projects", options: void (0) });
        const info = await apiCall<SystemAPI, "getSystemInfo">(SYSTEM_URL, "getSystemInfo");
        this._uptimeSpan.value = secondsToHms(info.uptime);
    }
}

function secondsToHms(seconds: number) {
    let d = Math.floor(seconds / (24 * 3600));
    let h = Math.floor(seconds / 3600) % 24;
    let m = Math.floor((seconds % 3600) / 60);
    let s = seconds % 60;

    // Ajoute des zéros si nécessaire
    const hh = h < 10 ? '0' + h : h;
    const mm = m < 10 ? '0' + m : m;
    const ss = s < 10 ? '0' + s : s;

    return `${d}d ${hh}:${mm}:${ss}`;
}


customElements.define("maintenance-page", MaintenancePage);
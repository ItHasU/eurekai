import { EntitiesHandler } from "@dagda/shared/entities/handler";
import { EntitiesEvents, TablesDefinition } from "@dagda/shared/entities/types";
import { NotificationHelper } from "@dagda/shared/tools/notification.helper";

/** 
 * A simple component to display communication status of the SQLHandler.
 * This component cannot be inserted in HTML as it requires and handler at construction.
 */
export class SQLStatusComponent<Tables extends TablesDefinition, Contexts> extends HTMLElement {

    protected _downloadIcon: HTMLElement;
    protected _uploadIcon: HTMLElement;
    protected _uploadCountSpan: HTMLSpanElement;
    protected _refreshIcon: HTMLElement;
    protected _disconnectedIcon: HTMLElement;

    constructor(handler: EntitiesHandler<Tables, Contexts>) {
        super();
        this.innerHTML = require("./status.component.html").default;
        this._downloadIcon = this.querySelector(`i[ref="downloadIcon"]`)!;
        this._uploadIcon = this.querySelector(`i[ref="uploadIcon"]`)!;
        this._uploadCountSpan = this.querySelector(`span[ref="uploadCountSpan"]`)!;
        this._refreshIcon = this.querySelector(`i[ref="refreshIcon"]`)!;
        this._disconnectedIcon = this.querySelector(`i[ref="disconnectedIcon"]`)!;

        handler.on("state", (event) => {
            this._refresh(event.data);
        });
        NotificationHelper.on("connected", (event) => {
            this._disconnectedIcon.classList.toggle("d-none", !!event.data);
        });
    }

    protected _refresh(data: EntitiesEvents["state"]): void {
        this._downloadIcon.classList.toggle("d-none", data.downloading === 0);
        this._uploadIcon.classList.toggle("d-none", data.uploading === 0);
        this._uploadCountSpan.classList.toggle("d-none", data.uploading < 2);
        this._uploadCountSpan.innerHTML = "" + data.uploading;
        this._refreshIcon.classList.toggle("text-danger", data.dirty);
        if (data.dirty) {
            this._refreshIcon.parentElement?.parentElement?.animate([
                { transform: "scale(1)" },
                { transform: "scale(1.2)" },
                { transform: "scale(1)" },
            ], {
                duration: 200,
                iterations: 1
            }).play();
        }
    }
}

customElements.define("dagda-sql-status", SQLStatusComponent);
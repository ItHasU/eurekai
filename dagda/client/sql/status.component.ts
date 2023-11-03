import { SQLEvents, SQLHandler } from "@dagda/shared/sql/handler";
import { TablesDefinition } from "@dagda/shared/sql/types";

/** 
 * A simple component to display communication status of the SQLHandler.
 * This component cannot be inserted in HTML as it requires and handler at construction.
 */
export class SQLStatusComponent<Tables extends TablesDefinition, Filter> extends HTMLElement {

    protected _downloadIcon: HTMLElement;
    protected _uploadIcon: HTMLElement;
    protected _refreshIcon: HTMLElement;

    constructor(handler: SQLHandler<Tables, Filter>, refreshCB: () => void) {
        super();
        this.innerHTML = require("./status.component.html").default;
        this._downloadIcon = this.querySelector(`i[ref="downloadIcon"]`)!;
        this._uploadIcon = this.querySelector(`i[ref="uploadIcon"]`)!;
        this._refreshIcon = this.querySelector(`i[ref="refreshIcon"]`)!;

        handler.on("state", (event) => {
            this._refresh(event.data);
        });
        this.addEventListener("click", refreshCB);
    }

    protected _refresh(data: SQLEvents["state"]): void {
        this._downloadIcon.classList.toggle("d-none", !data.downloading);
        this._uploadIcon.classList.toggle("d-none", !data.uploading);
        this._refreshIcon.classList.toggle("text-danger", data.dirty);
    }
}

customElements.define("dagda-sql-status", SQLStatusComponent);
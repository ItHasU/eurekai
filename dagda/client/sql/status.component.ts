import { SQLEvents, SQLHandler } from "@dagda/shared/sql/handler";
import { TablesDefinition } from "@dagda/shared/sql/types";

/** 
 * A simple component to display communication status of the SQLHandler.
 * This component cannot be inserted in HTML as it requires and handler at construction.
 */
export class SQLStatusComponent<Tables extends TablesDefinition, Filter> extends HTMLElement {

    protected _downloadIcon: HTMLElement;
    protected _uploadIcon: HTMLElement;
    protected _dirtyIcon: HTMLElement;

    constructor(handler: SQLHandler<Tables, Filter>) {
        super();
        this.innerHTML = require("./status.component.html").default;
        this._downloadIcon = this.querySelector(`i[ref="downloadIcon"]`)!;
        this._uploadIcon = this.querySelector(`i[ref="uploadIcon"]`)!;
        this._dirtyIcon = this.querySelector(`i[ref="dirtyIcon"]`)!;

        handler.on("state", (event) => {
            this._refresh(event.data);
        });
    }

    protected _refresh(data: SQLEvents["state"]): void {
        this._downloadIcon.classList.toggle("text-light", data.downloading);
        this._uploadIcon.classList.toggle("text-light", data.uploading);
        this._dirtyIcon.classList.toggle("d-none", !data.dirty);
    }
}

customElements.define("dagda-sql-status", SQLStatusComponent);
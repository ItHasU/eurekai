import { AbstractPageElement } from "./abstract.page.element";
import { DataCache } from "@eurekai/shared/src/cache";

/** Display projects and fire an event on project change */
export class SettingsPage extends AbstractPageElement {

    protected readonly _settingsModelSelect: HTMLSelectElement;

    constructor(cache: DataCache) {
        super(require("./settings.page.html").default, cache);

        this._settingsModelSelect = this.querySelector("#settingsModelSelect") as HTMLSelectElement;
        this._settingsModelSelect.addEventListener("change", async () => {
            const model = this._settingsModelSelect.value;
            await this._cache.withData(data => data.setModel(model));
            this.refresh();
        });

        this._bindClickForRef("vacuumButton", async () => {
            await this._cache.data.vacuum();
        });
        this._bindClickForRef("fixHighresButton", async () => {
            await this._cache.data.fixHighres();
        });
    }

    /** @inheritdoc */
    protected override async _refresh(): Promise<void> {
        const models = await this._cache.data.getModels();
        const selected = await this._cache.data.getModel();

        models.sort((a, b) => a.title.localeCompare(b.title));

        this._settingsModelSelect.innerHTML = "";
        for (const model of models) {
            const option = document.createElement("option");
            option.innerText = model.title;
            option.value = model.title;
            if (model.title === selected) {
                option.selected = true;
            }
            this._settingsModelSelect.appendChild(option);
        }
    }

}

customElements.define("settings-page", SettingsPage);
import { AbstractPageElement } from "./abstract.page.element";
import { DataCache } from "@eurekai/shared/src/cache";

/** Display projects and fire an event on project change */
export class EditPage extends AbstractPageElement {

    protected readonly _nameInput: HTMLInputElement;
    protected readonly _widthInput: HTMLInputElement;
    protected readonly _heightInput: HTMLInputElement;
    protected readonly _scaleInput: HTMLInputElement;

    constructor(cache: DataCache) {
        super(require("./edit.page.html").default, cache);

        // -- Get components --
        this._nameInput = this.querySelector("#projectNameInput") as HTMLInputElement;
        this._widthInput = this.querySelector("#widthInput") as HTMLInputElement;
        this._heightInput = this.querySelector("#heightInput") as HTMLInputElement;
        this._scaleInput = this.querySelector("#scaleInput") as HTMLInputElement;

        // Bind click on add project
        this._bindClickForRef("updateButton", async () => {
            const projectId = await this._cache.getSelectedProjectId();
            if (!projectId) {
                return;
            }
            const name = this._nameInput.value;
            const width = +this._widthInput.value;
            const height = +this._heightInput.value;
            const scale = +this._scaleInput.value;
            if (name && width && height) {
                try {
                    await this._cache.withData(async (data) => {
                        await data.updateProject(projectId, name, width, height, scale);
                    });
                } catch (err) {
                    console.error(err);
                } finally {
                    await this.refresh();
                }
            }
        });
        this._bindClickForRef("deleteButton", async () => {
            const projectId = await this._cache.getSelectedProjectId();
            if (!projectId) {
                return;
            }
            console.log(`Deleting project ${projectId}`);
            try {
                await this._cache.withData(async (data) => {
                    await data.deleteProject(projectId);
                });
            } catch (err) {
                console.error(err);
            } finally {
                await this.refresh();
            }
        });
    }

    /** @inheritdoc */
    public override async _refresh(): Promise<void> {
        // -- Clean inputs --
        this._nameInput.value = "";
        this._widthInput.value = "";
        this._heightInput.value = "";
        this._scaleInput.value = "";

        // -- Get selected project --
        const projectId = await this._cache.getSelectedProjectId();
        if (projectId == null) {
            return;
        }
        const project = await this._cache.getProject(projectId);
        if (!project) {
            return;
        }

        // -- Set inputs --
        this._nameInput.value = project.name;
        this._widthInput.value = project.width.toString();
        this._heightInput.value = project.height.toString();
        this._scaleInput.value = project.scale.toString();
    }
}

customElements.define("edit-page", EditPage);
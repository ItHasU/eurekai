import { BooleanEnum } from "@eurekai/shared/src/types";
import { AbstractPageElement } from "./abstract.page.element";
import { DataCache } from "@eurekai/shared/src/cache";

/** Display projects and fire an event on project change */
export class EditPage extends AbstractPageElement {

    protected readonly _nameInput: HTMLInputElement;
    protected readonly _widthInput: HTMLInputElement;
    protected readonly _heightInput: HTMLInputElement;
    protected readonly _scaleInput: HTMLInputElement;
    protected readonly _lockableInput: HTMLInputElement;

    constructor(cache: DataCache) {
        super(require("./edit.page.html").default, cache);

        // -- Get components --
        this._nameInput = this.querySelector("#projectNameInput") as HTMLInputElement;
        this._widthInput = this.querySelector("#widthInput") as HTMLInputElement;
        this._heightInput = this.querySelector("#heightInput") as HTMLInputElement;
        this._scaleInput = this.querySelector("#scaleInput") as HTMLInputElement;
        this._lockableInput = this.querySelector("#lockableInput") as HTMLInputElement;

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
            const lockable = this._lockableInput.checked ? BooleanEnum.TRUE : BooleanEnum.FALSE;
            if (name && width && height) {
                try {
                    await this._cache.withData(async (data) => {
                        await data.updateProject(projectId, name, width, height, scale, lockable);
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
        this._lockableInput.checked = false;

        // -- Get selected project --
        const project = await this._cache.getSelectedProject();
        if (!project) {
            return;
        }

        // -- Set inputs --
        this._nameInput.value = project.name;
        this._widthInput.value = project.width.toString();
        this._heightInput.value = project.height.toString();
        this._scaleInput.value = project.scale.toString();
        this._lockableInput.checked = project.lockable === BooleanEnum.TRUE ? true : false;
    }
}

customElements.define("edit-page", EditPage);
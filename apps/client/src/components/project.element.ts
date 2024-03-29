import { ProjectEntity } from "@eurekai/shared/src/entities";
import { AbstractDTOElement } from "./abstract.dto.element";
import { showConfirm } from "./tools";

export class ProjectElement extends AbstractDTOElement<ProjectEntity> {

    constructor(project: ProjectEntity, protected _options: {
        rename: (name: string) => void;
        pin: () => void;
        unpin: () => void;
        lock: () => void;
        unlock: () => void;
        delete: () => void;
    }) {
        super(project, require("./project.element.html").default);
        this.classList.add("list-group-item", "list-group-item-action");
        this.classList.toggle("lockable", project.lockable === true);
    }

    public override refresh(): void {
        super.refresh();
        if (this.data.pinned === true) {
            this._getElementByRef("pin")?.parentElement?.classList.add("d-none");
        } else {
            this._getElementByRef("unpin")?.parentElement?.classList.add("d-none");
        }
        if (this.data.lockable === true) {
            this._getElementByRef("lock")?.parentElement?.classList.add("d-none");
        } else {
            this._getElementByRef("unlock")?.parentElement?.classList.add("d-none");
        }
        // Prevent click on dropdown to select the project
        this.querySelector('.dropdown button')?.addEventListener('click', function (event) {
            event.stopPropagation();
        });

        if (this.data.featuredAttachmentId != null) {
            (<HTMLImageElement>this.querySelector("[ref='featured']")!).src = `/attachment/${this.data.featuredAttachmentId}`;
        }
        this._bindClick("rename", (evt) => {
            evt.stopPropagation();
            // Replace title by an input
            const nameSpan = this._getElementByRef("name");
            if (nameSpan == null) {
                return;
            }
            nameSpan.innerHTML = `<input type="text" class="form-control" value="${this.data.name}">`;
            const input = nameSpan.querySelector("input");
            if (!input) {
                return;
            }
            // -- Bind input events --
            input.addEventListener("click", (evt) => evt.stopPropagation()); // Prevent click on input to select the project
            input.addEventListener("change", async () => {
                const name = nameSpan.querySelector("input")?.value;
                if (name) {
                    this._options.rename(name);
                    input.classList.add("is-valid");
                }
            });
            // -- Hide the dropdown menu --
            // TODO Find a better way to close the dropdown
            (this.querySelector("button[data-bs-toggle=\"dropdown\"]") as HTMLButtonElement)?.click();
            // -- Force focus on the input to allow immediate typing --
            input.focus();
        });
        this._bindClick("pin", (evt) => {
            evt.stopPropagation();
            this._options.pin();
        });
        this._bindClick("unpin", (evt) => {
            evt.stopPropagation();
            this._options.unpin();
        });
        this._bindClick("lock", (evt) => {
            evt.stopPropagation();
            this._options.lock();
        });
        this._bindClick("unlock", (evt) => {
            evt.stopPropagation();
            this._options.unlock();
        });
        this._bindClick("delete", (evt) => {
            evt.stopPropagation();
            showConfirm({ title: "Delete project", message: `Do you want to delete the project to "${this.data.name}"?` }).then((result) => {
                if (result) {
                    this._options.delete();
                }
            }).catch(console.error);
        });
    }

}

customElements.define("custom-project", ProjectElement);

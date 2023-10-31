import { BooleanEnum, ProjectDTO } from "@eurekai/shared/src/types";
import { AbstractDTOElement } from "./abstract.dto.element";

export class ProjectElement extends AbstractDTOElement<ProjectDTO> {

    constructor(project: ProjectDTO, protected _options: {
        pin: () => void;
        unpin: () => void;
        lock: () => void;
        unlock: () => void;
    }) {
        super(project, require("./project.element.html").default);
        this.classList.add("list-group-item", "list-group-item-action");
        this.classList.toggle("lockable", project.lockable === BooleanEnum.TRUE);

        this.addEventListener("click", () => {
            // this._cache.setSelectedProjectId(project.id);
            // APP.setPage(PicturesPage);
        });
    }

    public override refresh(): void {
        super.refresh();
        if (this.data.pinned === BooleanEnum.TRUE) {
            this._getElementByRef("pin")?.parentElement?.classList.add("d-none");
        } else {
            this._getElementByRef("unpin")?.parentElement?.classList.add("d-none");
        }
        if (this.data.lockable === BooleanEnum.TRUE) {
            this._getElementByRef("lock")?.parentElement?.classList.add("d-none");
        } else {
            this._getElementByRef("unlock")?.parentElement?.classList.add("d-none");
        }
        // this.querySelector('.dropdown button')?.addEventListener('click', function (event) {
        //     event.stopPropagation();
        // });

        if (this.data.featuredAttachmentId != null) {
            (<HTMLImageElement>this.querySelector("[ref='featured']")!).src = `/api/attachment/${this.data.featuredAttachmentId}`;
        }
        this._bindClick("pin", (evt) => {
            this._options.pin();
        });
        this._bindClick("unpin", (evt) => {
            this._options.unpin();
        });
        this._bindClick("lock", (evt) => {
            this._options.lock();
        });
        this._bindClick("unlock", (evt) => {
            this._options.unlock();
        });
    }

}

customElements.define("custom-project", ProjectElement);

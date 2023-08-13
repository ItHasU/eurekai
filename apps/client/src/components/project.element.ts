import { BooleanEnum, ProjectWithStats } from "@eurekai/shared/src/types";
import { AbstractDTOElement } from "./abstract.dto.element";
import { DataCache } from "@eurekai/shared/src/cache";

export class ProjectElement extends AbstractDTOElement<ProjectWithStats> {

    constructor(protected readonly _cache: DataCache, project: ProjectWithStats, protected _options: {
        clean: () => void;
        pin: () => void;
        unpin: () => void;
    }) {
        super(project, require("./project.element.html").default);
        this.classList.add("list-group-item", "list-group-item-action");
        this.classList.toggle("lockable", project.lockable === BooleanEnum.TRUE);

        this.addEventListener("click", () => {
            this._cache.setSelectedProjectId(project.id);
        });
    }

    public override refresh(): void {
        super.refresh();
        if (this.data.pinned === BooleanEnum.TRUE) {
            this._getElementByRef("pin")?.parentElement?.classList.add("d-none");
        } else {
            this._getElementByRef("unpin")?.parentElement?.classList.add("d-none");
        }
        this.querySelector('.dropdown button')?.addEventListener('click', function (event) {
            event.stopPropagation();
        });

        if (this.data.featuredAttachmentId != null) {
            (<HTMLImageElement>this.querySelector("[ref='featured']")!).src = `/api/attachment/${this.data.featuredAttachmentId}`;
        }
        this._bindClick("clean", (evt) => {
            evt.stopPropagation();

            this._options.clean();
            this.data.rejectedCount = 0;
            this.refresh();
        });
        this._bindClick("pin", (evt) => {
            evt.stopPropagation();

            this._options.pin();
        });
        this._bindClick("unpin", (evt) => {
            evt.stopPropagation();

            this._options.unpin();
        });
    }

}

customElements.define("custom-project", ProjectElement);

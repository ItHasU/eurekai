import { ProjectWithStats } from "@eurekai/shared/src/types";
import { AbstractDTOElement } from "./abstract.dto.element";
import { DataCache } from "@eurekai/shared/src/cache";

export class ProjectElement extends AbstractDTOElement<ProjectWithStats> {

    constructor(protected readonly _cache: DataCache, project: ProjectWithStats, protected _options: {
        clean: () => void;
    }) {
        super(project, require("./project.element.html").default);

        this.addEventListener("click", () => {
            this._cache.setSelectedProjectId(project.id);
        });
       
    }
    public override refresh(): void {
        super.refresh();

        this._bindClick("clean", (evt) => {
            evt.stopPropagation();

            this._options.clean();
            this.data.rejectedCount = 0;
            this.refresh();
        });
    }

}

customElements.define("custom-project", ProjectElement);

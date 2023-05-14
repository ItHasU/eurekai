import { ProjectWithStats } from "@eurekai/shared/src/types";
import { AbstractDTOElement } from "./abstract.dto.element";
import { DataCache } from "@eurekai/shared/src/cache";

export class ProjectElement extends AbstractDTOElement<ProjectWithStats> {

    constructor(protected readonly _cache: DataCache, project: ProjectWithStats) {
        super(project, require("./project.element.html").default);

        this.addEventListener("click", () => {
            this._cache.setSelectedProjectId(project.id);
        });
    }

}

customElements.define("custom-project", ProjectElement);

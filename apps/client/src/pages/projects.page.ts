import { ProjectDTO } from "@eurekai/shared/src/types";
import { AbstractPageElement } from "./abstract.page.element";
import { AbstractDataWrapper } from "@eurekai/shared/src/data";

/** Display projects and fire an event on project change */
export class ProjectsPage extends AbstractPageElement {

    protected _projects: ProjectDTO[] = [];

    constructor(protected _data: AbstractDataWrapper) {
        super(require("./projects.page.html").default, true);
    }

    /** For the template */
    public get projects(): ProjectDTO[] {
        return this._projects;
    }

    protected override async _loadData(): Promise<void> {
        this._projects = await this._data.getProjects();
    }

    protected override _postRender(): Promise<void> {
        // Bind click on projects
        this.querySelectorAll(".list-group-item-action").forEach(element => {
            element.addEventListener("click", () => {
                const id = parseInt(element.getAttribute("data-project-id") ?? "-1");
                console.debug(`Project ${id} selected`);
                this.dispatchEvent(new CustomEvent("project-change", { detail: id }));
            });
        });
        // Bind click on add project
        this._bindClick("projectNewButton", async () => {
            const name = (this.querySelector("#projectNameInput") as HTMLInputElement).value;
            const width = +(this.querySelector("#widthInput") as HTMLInputElement).value;
            const height = +(this.querySelector("#heightInput") as HTMLInputElement).value;
            if (name && width && height) {
                try {
                    const newProjectId = await this._data.addProject(name, width, height);
                    console.debug(`Project ${newProjectId} created ${width}x${height}px`);
                    await this.refresh();
                } catch (err) {
                    console.error(err);
                }
            }
        });
        return Promise.resolve();
    }
}

customElements.define("projects-page", ProjectsPage);
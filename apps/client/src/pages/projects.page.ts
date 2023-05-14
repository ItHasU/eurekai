import { AbstractPageElement } from "./abstract.page.element";
import { DataCache } from "@eurekai/shared/src/cache";
import { ProjectElement } from "../components/project.element";

/** Display projects and fire an event on project change */
export class ProjectsPage extends AbstractPageElement {

    protected readonly _nameInput: HTMLInputElement;
    protected readonly _widthInput: HTMLInputElement;
    protected readonly _heightInput: HTMLInputElement;
    protected readonly _projectsDiv: HTMLDivElement;

    constructor(cache: DataCache) {
        super(require("./projects.page.html").default, cache);

        // -- Get components --
        this._nameInput = this.querySelector("#projectNameInput") as HTMLInputElement;
        this._widthInput = this.querySelector("#widthInput") as HTMLInputElement;
        this._heightInput = this.querySelector("#heightInput") as HTMLInputElement;
        this._projectsDiv = this.querySelector("#projectsDiv") as HTMLDivElement;

        // Bind click on add project
        this._bindClickForRef("projectNewButton", async () => {
            const name = this._nameInput.value;
            const width = +this._widthInput.value;
            const height = +this._heightInput.value;
            if (name && width && height) {
                try {
                    await this._cache.withData(async (data) => {
                        const newProjectId = await data.addProject(name, width, height);
                        console.debug(`Project ${newProjectId} created ${width} x ${height} px`);
                    });
                } catch (err) {
                    console.error(err);
                } finally {
                    await this.refresh();
                }
            }
        });
    }

    /** @inheritdoc */
    public override async _refresh(): Promise<void> {
        // -- Fech projects --
        const projects = await this._cache.getProjects();

        // -- Render projects --
        // Clear projects
        this._projectsDiv.innerHTML = "";
        // Render projects
        for (const project of projects) {
            const element = new ProjectElement(this._cache, project);
            element.addEventListener("click", () => {
                console.debug(`Project ${project.id} selected`);
                this._cache.setSelectedProjectId(project.id);
            });
            this._projectsDiv.appendChild(element);
            element.refresh();
        }
    }
}

customElements.define("projects-page", ProjectsPage);
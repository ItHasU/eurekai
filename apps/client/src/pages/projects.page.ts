import { AbstractPageElement } from "./abstract.page.element";
import { DataCache } from "@eurekai/shared/src/cache";
import { ProjectElement } from "../components/project.element";

const BORDER_CLASSES = ["border-primary", "border-2"];

/** Display projects and fire an event on project change */
export class ProjectsPage extends AbstractPageElement {

    protected readonly _nameInput: HTMLInputElement;
    protected readonly _widthInput: HTMLInputElement;
    protected readonly _heightInput: HTMLInputElement;
    protected readonly _projectsActiveDiv: HTMLDivElement;
    protected readonly _projectsArchivedDiv: HTMLDivElement;

    constructor(cache: DataCache) {
        super(require("./projects.page.html").default, cache);

        // -- Get components --
        this._nameInput = this.querySelector("#projectNameInput") as HTMLInputElement;
        this._widthInput = this.querySelector("#widthInput") as HTMLInputElement;
        this._heightInput = this.querySelector("#heightInput") as HTMLInputElement;
        this._projectsActiveDiv = this.querySelector("#projectsActiveDiv") as HTMLDivElement;
        this._projectsArchivedDiv = this.querySelector("#projectsArchivedDiv") as HTMLDivElement;

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
        const projects = [...await this._cache.getProjects()];
        projects.sort((a, b) => -(a.id - b.id));

        // -- Render projects --
        // Clear projects
        this._projectsActiveDiv.innerHTML = "";
        this._projectsArchivedDiv.innerHTML = "";
        // Render projects
        for (const project of projects) {
            const projectId = project.id;
            const element = new ProjectElement(this._cache, project, {
                clean: () => {
                    this._cache.withData(async (data) => {
                        await data.cleanProject(projectId);
                    }).finally(() => {
                        this._cache.markDirty();
                    });
                }
            });
            element.addEventListener("click", () => {
                console.debug(`Project ${project.id} selected`);
                this._cache.setSelectedProjectId(project.id);
                // Remove border from all projects
                this.querySelectorAll(".card")?.forEach((card) => {
                    card.classList.remove(...BORDER_CLASSES);
                });
                element.querySelector(".card")?.classList.add(...BORDER_CLASSES);
            });
            if (project.highresPendingCount > 0 || project.activePrompts > 0) {
                this._projectsActiveDiv.appendChild(element);
            } else {
                this._projectsArchivedDiv.appendChild(element);
            }
            element.refresh();
            if (projectId === this._cache.getSelectedProjectId()) {
                element.querySelector(".card")?.classList.add(...BORDER_CLASSES);
            }
        }
    }
}

customElements.define("projects-page", ProjectsPage);
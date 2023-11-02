import { BooleanEnum } from "@eurekai/shared/src/types";
import { ProjectElement } from "../components/project.element";
import { AbstractPageElement, DataProvider } from "./abstract.page.element";

const BORDER_CLASSES = ["border-primary", "border-2"];

/** Display projects and fire an event on project change */
export class ProjectsPage extends AbstractPageElement {

    protected readonly _nameInput: HTMLInputElement;
    protected readonly _widthInput: HTMLInputElement;
    protected readonly _heightInput: HTMLInputElement;
    protected readonly _projectsPinnedDiv: HTMLDivElement;
    protected readonly _projectsActiveDiv: HTMLDivElement;
    protected readonly _projectsArchivedDiv: HTMLDivElement;

    constructor(data: DataProvider) {
        super(require("./projects.page.html").default, data);

        // -- Get components --
        this._nameInput = this.querySelector("#projectNameInput") as HTMLInputElement;
        this._widthInput = this.querySelector("#widthInput") as HTMLInputElement;
        this._heightInput = this.querySelector("#heightInput") as HTMLInputElement;
        this._projectsPinnedDiv = this.querySelector("#projectsPinnedDiv") as HTMLDivElement;
        this._projectsActiveDiv = this.querySelector("#projectsActiveDiv") as HTMLDivElement;
        this._projectsArchivedDiv = this.querySelector("#projectsArchivedDiv") as HTMLDivElement;

        // Bind click on add project
        this._bindClickForRef("projectNewButton", async () => {
            const name = this._nameInput.value;
            if (name) {
                await this._data.getSQLHandler().withTransaction((tr) => {
                    tr.insert("projects", {
                        id: 0,
                        lockable: BooleanEnum.FALSE,
                        name,
                        pinned: BooleanEnum.FALSE
                    });
                });
                await this.refresh();
            }
        });
    }

    /** @inheritdoc */
    public override async _refresh(): Promise<void> {
        await this._data.getSQLHandler().fetch({ type: "projects", options: void (0) });

        // -- Fetch projects --
        const projects = this._data.getSQLHandler().getItems("projects");
        projects.sort((a, b) => -(a.id - b.id));

        // -- Render projects --
        // Clear projects
        this._projectsPinnedDiv.innerHTML = "";
        this._projectsActiveDiv.innerHTML = "";
        this._projectsArchivedDiv.innerHTML = "";

        // Render projects
        for (const project of projects) {
            const element = new ProjectElement(project, {
                pin: async () => {
                    await this._data.getSQLHandler().withTransaction((tr) => {
                        tr.update("projects", project, { pinned: BooleanEnum.TRUE });
                    });
                    this.refresh();
                },
                unpin: async () => {
                    await this._data.getSQLHandler().withTransaction((tr) => {
                        tr.update("projects", project, { pinned: BooleanEnum.FALSE });
                    });
                    this.refresh();
                },
                lock: async () => {
                    await this._data.getSQLHandler().withTransaction((tr) => {
                        tr.update("projects", project, { lockable: BooleanEnum.TRUE });
                    });
                    this.refresh();
                },
                unlock: async () => {
                    await this._data.getSQLHandler().withTransaction((tr) => {
                        tr.update("projects", project, { lockable: BooleanEnum.FALSE });
                    });
                    this.refresh();
                }
            });
            element.addEventListener("click", () => {
                console.debug(`Project ${project.id} selected`);
                this._data.setSelectedProject(project.id);
                // Remove border from all projects
                this.querySelectorAll(".card")?.forEach((card) => {
                    card.classList.remove(...BORDER_CLASSES);
                });
                element.querySelector(".card")?.classList.add(...BORDER_CLASSES);
            });
            if (project.pinned === BooleanEnum.TRUE) {
                this._projectsPinnedDiv.appendChild(element);
                // } else if (project.highresPendingCount > 0 || project.activePrompts > 0) {
                //     this._projectsActiveDiv.appendChild(element);
            } else {
                this._projectsArchivedDiv.appendChild(element);
            }
            element.refresh();
            // if (projectId === this._cache.getSelectedProjectId()) {
            //     element.querySelector(".card")?.classList.add(...BORDER_CLASSES);
            // }
        }
    }
}

customElements.define("projects-page", ProjectsPage);
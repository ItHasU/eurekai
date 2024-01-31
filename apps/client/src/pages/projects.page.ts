import { asNamed } from "@dagda/shared/entities/named.types";
import { deleteProject } from "@eurekai/shared/src/pictures.data";
import { APP } from "src";
import { StaticDataProvider } from "src/tools/dataProvider";
import { ProjectElement } from "../components/project.element";
import { AbstractPageElement } from "./abstract.page.element";
import { PicturesPage } from "./pictures.page";

const BORDER_CLASSES = ["border-primary", "border-2"];

/** Display projects and fire an event on project change */
export class ProjectsPage extends AbstractPageElement {

    protected readonly _nameInput: HTMLInputElement;
    protected readonly _widthInput: HTMLInputElement;
    protected readonly _heightInput: HTMLInputElement;
    protected readonly _projectsPinnedDiv: HTMLDivElement;
    protected readonly _projectsActiveDiv: HTMLDivElement;
    protected readonly _projectsArchivedDiv: HTMLDivElement;

    constructor() {
        super(require("./projects.page.html").default);

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
                await StaticDataProvider.entitiesHandler.withTransaction((tr) => {
                    tr.insert("projects", {
                        id: asNamed(0),
                        lockable: asNamed(false),
                        name: asNamed(name),
                        pinned: asNamed(true),
                        featuredAttachmentId: null
                    });
                });
                await this.refresh();
            }
        });
    }

    /** @inheritdoc */
    public override async _refresh(): Promise<void> {
        await StaticDataProvider.entitiesHandler.fetch({ type: "projects", options: void (0) });

        // -- Fetch projects --
        const projects = StaticDataProvider.entitiesHandler.getItems("projects");
        projects.sort((a, b) => -(a.id - b.id));

        // -- Render projects --
        // Clear projects
        this._projectsPinnedDiv.innerHTML = "";
        this._projectsActiveDiv.innerHTML = "";
        this._projectsArchivedDiv.innerHTML = "";

        // Render projects
        for (const project of projects) {
            const element = new ProjectElement(project, {
                rename: async (name: string) => {
                    await StaticDataProvider.entitiesHandler.withTransaction((tr) => {
                        tr.update("projects", project, { name: asNamed(name) });
                    });
                    element.refresh();
                },
                pin: async () => {
                    await StaticDataProvider.entitiesHandler.withTransaction((tr) => {
                        tr.update("projects", project, { pinned: asNamed(true) });
                    });
                    // Refresh the whole page because position has changed
                    await this.refresh();
                },
                unpin: async () => {
                    await StaticDataProvider.entitiesHandler.withTransaction((tr) => {
                        tr.update("projects", project, { pinned: asNamed(false) });
                    });
                    // Refresh the whole page because position has changed
                    await this.refresh();
                },
                lock: async () => {
                    await StaticDataProvider.entitiesHandler.withTransaction((tr) => {
                        tr.update("projects", project, { lockable: asNamed(true) });
                    });
                    // Refreshing the element is enough
                    element.refresh();
                },
                unlock: async () => {
                    await StaticDataProvider.entitiesHandler.withTransaction((tr) => {
                        tr.update("projects", project, { lockable: asNamed(false) });
                    });
                    // Refreshing the element is enough
                    element.refresh();
                },
                delete: async () => {
                    // Make sure we have all the project's data
                    await StaticDataProvider.entitiesHandler.fetch({ type: "project", options: { projectId: project.id } });
                    await StaticDataProvider.entitiesHandler.withTransaction((tr) => {
                        deleteProject(StaticDataProvider.entitiesHandler, tr, project.id);
                    });
                    // Here we need to refresh the whole page because the project is deleted
                    await this.refresh();
                }
            });
            element.addEventListener("click", () => {
                console.debug(`Project ${project.id} selected`);
                StaticDataProvider.setSelectedProject(project.id);
                APP.setPage(PicturesPage);
            });
            if (project.pinned === true) {
                this._projectsPinnedDiv.appendChild(element);
            } else {
                this._projectsArchivedDiv.appendChild(element);
            }
            element.refresh();
            if (project.id === StaticDataProvider.getSelectedProject()) {
                element.querySelector(".card")?.classList.add(...BORDER_CLASSES);
            }
        }
    }
}

customElements.define("projects-page", ProjectsPage);
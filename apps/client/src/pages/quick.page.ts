import { asNamed } from "@dagda/shared/entities/named.types";
import { ComputationStatus, PictureEntity, ProjectEntity, ProjectId, PromptEntity } from "@eurekai/shared/src/entities";
import { isPreferredSeed, togglePreferredSeed } from "@eurekai/shared/src/pictures.data";
import { APP } from "src";
import { PictureElement } from "src/components/picture.element";
import { PromptElement } from "src/components/prompt.element";
import { StaticDataProvider } from "src/tools/dataProvider";
import { AbstractPageElement } from "./abstract.page.element";
import { PicturesPage } from "./pictures.page";

/** Display projects and fire an event on project change */
export class QuickPage extends AbstractPageElement {

    protected readonly _pictureDiv: HTMLImageElement;

    constructor() {
        super(require("./quick.page.html").default);
        this.classList.add("d-flex", "flex-column", "h-100");
        // -- Get components --
        this._pictureDiv = this.querySelector("#pictureDiv") as HTMLImageElement;
    }

    /** @inheritdoc */
    protected override async _refresh(): Promise<void> {
        // -- Make sure cache is updated --
        const projectId = StaticDataProvider.getSelectedProject();

        if (projectId == null) {
            APP.setPage(PicturesPage);
            return;
        }

        // -- Async part ------------------------------------------------------
        await StaticDataProvider.getModels();
        const dataWereLoaded = await StaticDataProvider.entitiesHandler.fetch({
            type: "project",
            options: {
                projectId
            }
        });

        // -- Render data -----------------------------------------------------
        this._refreshImpl(projectId);
    }

    /** Render data from the cache (does not reload data) */
    protected _refreshImpl(projectId: ProjectId): void {
        // -- Clear -----------------------------------------------------------
        this._pictureDiv.innerHTML = "";

        // -- Prepare data ----------------------------------------------------
        // Project
        const project = StaticDataProvider.entitiesHandler.getCache("projects").getById(projectId)
        if (project == null) {
            // Nothing to display
            return;
        }

        // -- Get the next picture to display --
        let nextPicture: PictureEntity | null = null;
        let nextPicturePrompt: PromptEntity | null = null;
        for (const picture of StaticDataProvider.entitiesHandler.getCache("pictures").getItems()) {
            if (picture.status !== asNamed(ComputationStatus.DONE)) {
                // Only keep pictures that require evaluation
                continue;
            }

            const picturePrompt = StaticDataProvider.entitiesHandler.getCache("prompts").getById(picture.promptId);
            if (picturePrompt == null) {
                // Failed to load the prompt, can't evaluate if the picture is for the current project
                continue;
            }
            nextPicturePrompt = picturePrompt;

            if (!StaticDataProvider.entitiesHandler.isSameId(project.id, picturePrompt.projectId)) {
                // Picture does not belong to the project
                continue;
            }

            nextPicture = picture;
            break;
        }

        if (nextPicture != null && nextPicturePrompt != null) {
            this._pictureDiv.src = `/attachment/${nextPicture.attachmentId}`;
        } else {
            APP.setPage(PicturesPage);
        }
    }

    protected _buildPictureElement(picture: PictureEntity, prompt: PromptEntity, project: ProjectEntity, promptItem?: PromptElement): PictureElement {
        const item = new PictureElement(picture, {
            prompt,
            isPreferredSeed: isPreferredSeed(StaticDataProvider.entitiesHandler, project.id, picture.seed),
            isLockable: project.lockable === true,
            accept: async () => {
                await StaticDataProvider.entitiesHandler.withTransaction(tr => {
                    tr.update("pictures", picture, {
                        status: asNamed(ComputationStatus.ACCEPTED)
                    });
                });
                this.refresh();
            },
            reject: async () => {
                await StaticDataProvider.entitiesHandler.withTransaction(tr => {
                    tr.update("pictures", picture, {
                        status: asNamed(ComputationStatus.REJECTED),
                        score: asNamed(0)
                    });
                });
                this.refresh();
            },
            toggleSeed: async () => {
                await StaticDataProvider.entitiesHandler.withTransaction(tr => {
                    togglePreferredSeed(StaticDataProvider.entitiesHandler, tr, project.id, picture.seed);
                });
                item._options.isPreferredSeed = isPreferredSeed(StaticDataProvider.entitiesHandler, project.id, picture.seed);
                item.refresh();
            },
            setAsFeatured: async () => {
                await StaticDataProvider.entitiesHandler.withTransaction(tr => {
                    tr.update("projects", project, {
                        featuredAttachmentId: picture.attachmentId
                    });
                });
            },
            setScore: async (score) => {
                await StaticDataProvider.entitiesHandler.withTransaction(tr => {
                    tr.update("pictures", picture, {
                        score
                    });
                });
                item.refresh();
            }
        });
        return item;
    }

}

customElements.define("quick-page", QuickPage);
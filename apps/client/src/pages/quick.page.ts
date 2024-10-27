import { asNamed } from "@dagda/shared/entities/named.types";
import { wait } from "@dagda/shared/tools/async";
import { ComputationStatus, PictureEntity, ProjectId, PromptEntity } from "@eurekai/shared/src/entities";
import { APP } from "src";
import { bindTouchEvents } from "src/components/picture.element";
import { StaticDataProvider } from "src/tools/dataProvider";
import { AbstractPageElement } from "./abstract.page.element";
import { PicturesPage } from "./pictures.page";

/** Display projects and fire an event on project change */
export class QuickPage extends AbstractPageElement {

    protected readonly _pictureDiv: HTMLImageElement;
    protected readonly _overlayDiv: HTMLDivElement;
    protected readonly _keydownCallback = this._onKeydownCallback.bind(this);

    protected _nextPicture: PictureEntity | null = null;

    constructor() {
        super(require("./quick.page.html").default);
        this.classList.add("d-flex", "flex-column", "h-100");

        // -- Get components --
        this._pictureDiv = this.querySelector("#pictureDiv") as HTMLImageElement;
        this._overlayDiv = this.querySelector("#overlayDiv") as HTMLDivElement;

        bindTouchEvents(this._pictureDiv.parentElement!, this._overlayDiv, {
            accept: this._updateImage.bind(this, ComputationStatus.ACCEPTED),
            reject: this._updateImage.bind(this, ComputationStatus.REJECTED)
        });
    }

    public override connectedCallback(): void {
        super.connectedCallback();

        // Bind keyboard callback when connected
        window.addEventListener("keydown", this._keydownCallback);
    }

    public disconnectedCallback(): void {
        // Unbind keyboard callback when disconnected to avoid triggering callbacks when done
        window.removeEventListener("keydown", this._keydownCallback);
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
        await StaticDataProvider.entitiesHandler.fetch({
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
        this._pictureDiv.src = "";
        this._overlayDiv.style.backgroundColor = "";

        // -- Prepare data ----------------------------------------------------
        // Project
        const project = StaticDataProvider.entitiesHandler.getCache("projects").getById(projectId)
        if (project == null) {
            // Nothing to display
            return;
        }
        this._pictureDiv.classList.toggle("lockable", project.lockable);

        // -- Get the next picture to display --
        this._nextPicture = null;
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

            this._nextPicture = picture;
            break;
        }

        if (this._nextPicture != null && nextPicturePrompt != null) {
            this._pictureDiv.src = `/attachment/${this._nextPicture.attachmentId}`;
        } else {
            APP.setPage(PicturesPage);
        }
    }

    protected async _updateImage(status: ComputationStatus): Promise<void> {
        switch (status) {
            case ComputationStatus.ACCEPTED:
                this._overlayDiv.style.backgroundColor = "rgb(0,255,0)";
                break;
            case ComputationStatus.REJECTED:
                this._overlayDiv.style.backgroundColor = "rgb(255,0,0)";
                break;
            default:
                this._overlayDiv.style.backgroundColor = "";
                break;
        }
        await StaticDataProvider.entitiesHandler.withTransaction(tr => {
            if (this._nextPicture != null) {
                tr.update("pictures", this._nextPicture, {
                    status: asNamed(status)
                });
            }
        });
        await wait(200);
        // Make sure to reset the picture
        this._nextPicture = null;
        await this.refresh();
    }

    protected _onKeydownCallback(evt: KeyboardEvent): void {
        Promise.resolve().then(async () => {
            switch (evt.key) {
                case "Escape":
                    evt.preventDefault();
                    APP.setPage(PicturesPage);
                    break;
                case "ArrowLeft":
                    evt.preventDefault();
                    await this._updateImage(ComputationStatus.REJECTED);
                    break;
                case "ArrowRight":
                    evt.preventDefault();
                    await this._updateImage(ComputationStatus.ACCEPTED);
                    break;
            }
        }).catch(e => console.error(e));
    }
}

customElements.define("quick-page", QuickPage);
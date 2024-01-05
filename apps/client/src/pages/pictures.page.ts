import { asNamed } from "@dagda/shared/entities/named.types";
import { ComputationStatus, PictureEntity, PromptEntity } from "@eurekai/shared/src/entities";
import { generateNextPictures, isPreferredSeed, togglePreferredSeed } from "@eurekai/shared/src/pictures.data";
import { PictureElement } from "src/components/picture.element";
import { PromptElement } from "src/components/prompt.element";
import { PromptEditor } from "src/editors/prompt.editor";
import { StaticDataProvider } from "src/tools/dataProvider";
import { AbstractPageElement } from "./abstract.page.element";

function scrollToNextSibling(node: HTMLElement): void {
    const parent = node.parentElement;
    if (!parent) {
        return;
    }

    const next = node.nextElementSibling as HTMLElement | null;
    if (next) {
        next.scrollIntoView({
            behavior: "smooth"
        });
    } else {
        // We are done
    }
}

/** Display projects and fire an event on project change */
export class PicturesPage extends AbstractPageElement {

    protected readonly _picturesDiv: HTMLDivElement;
    protected readonly _picturesFilterSelect: HTMLSelectElement;
    protected readonly _promptCard: HTMLDivElement;
    protected readonly _promptEditor: PromptEditor;

    constructor() {
        super(require("./pictures.page.html").default);

        // -- Get components --
        this._picturesDiv = this.querySelector("#picturesDiv") as HTMLDivElement;
        this._picturesFilterSelect = this.querySelector("#picturesFilterSelect") as HTMLSelectElement;

        this._promptCard = this.querySelector("#promptCard") as HTMLDivElement;
        this._promptEditor = this.querySelector("#promptEditor") as PromptEditor;

        // -- Bind callbacks for buttons --
        this._bindClickForRef("addPromptButton", this._openPromptPanel.bind(this));
        this._bindClickForRef("closePromptButton", this._closePromptPanel.bind(this));
        this._bindClickForRef("newPromptButton", this._onNewPromptClick.bind(this));
        this._bindClickForRef("zipButton", this._onZipClick.bind(this));
        this._bindClickForRef("clearRejectedButton", this._onClearRejectedButtonClick.bind(this));
        this._picturesFilterSelect.addEventListener("change", this.refresh.bind(this, false));
    }

    /** @inheritdoc */
    protected override async _refresh(): Promise<void> {
        // -- Make sure cache is updated --
        const projectId = StaticDataProvider.getSelectedProject();
        if (projectId == null) {
            return;
        }

        // -- Async part ------------------------------------------------------
        await StaticDataProvider.entitiesHandler.fetch({
            type: "project",
            options: {
                projectId
            }
        });
        const models = await StaticDataProvider.getModels();

        // -- Clear -----------------------------------------------------------
        this._picturesDiv.innerHTML = "";

        // -- Prepare data ----------------------------------------------------
        // Project
        const project = StaticDataProvider.entitiesHandler.getCache("projects").getById(projectId)
        if (project == null) {
            // Nothing to display
            return;
        }
        // Prompts for the project (there might be others in cache)
        const prompts = StaticDataProvider.entitiesHandler.getCache("prompts").getItems().filter(prompt => prompt.projectId === projectId);
        const promptsMap: { [id: number]: { prompt: PromptEntity, pictures: PictureEntity[] } } = {};
        for (const prompt of prompts) {
            promptsMap[prompt.id] = { prompt, pictures: [] };
        }
        // Pictures for the project (the ones associated to prompts of the project)
        const pictures: PictureEntity[] = [];
        for (const picture of StaticDataProvider.entitiesHandler.getCache("pictures").getItems()) {
            const promptForPicture = promptsMap[picture.promptId];
            if (promptForPicture == null) {
                // Prompt is not from the project since the map
                // only contains prompts from the project
            } else if (!StaticDataProvider.entitiesHandler.isSameId(promptForPicture.prompt.projectId, projectId)) {
                // Prompt is not from project 
                // (should never happen since prompt in map are already filtered)
            } else {
                promptForPicture.pictures.push(picture);
                pictures.push(picture);
            }
        }
        // TODO Preferred seeds
        const preferredSeeds: Set<number> = new Set(StaticDataProvider.entitiesHandler.getItems("seeds").filter(s => StaticDataProvider.entitiesHandler.isSameId(s.projectId, projectId)).map(s => s.seed));

        // -- Render per prompt -----------------------------------------------
        // Sort prompts per order index (inverted)
        prompts.sort((p1, p2) => {
            let res = 0;

            if (res === 0) {
                // Reverse order
                return -(p1.orderIndex - p2.orderIndex);
            }

            if (res === 0) {
                return p1.id - p2.id;
            }

            return res;
        });

        // -- Get the filter --
        let filter: (picture: PictureEntity) => boolean = this._getFilter(preferredSeeds);

        for (const prompt of prompts) {
            // -- Add a line break --
            const div = document.createElement("div");
            div.classList.add("w-100");
            this._picturesDiv.appendChild(div);

            // -- Render prompt --
            const promptItem = new PromptElement(prompt);
            promptItem.on("clone", (evt) => {
                this._openPromptPanel(evt.data.prompt);
            });
            promptItem.on("delete", () => {
                this.refresh();
            });

            promptItem.classList.add("col-12");
            promptItem.refresh();
            this._picturesDiv.appendChild(promptItem);

            // -- Render images --
            const picturesForPrompt = (promptsMap[prompt.id]?.pictures ?? []).filter(filter);
            picturesForPrompt.sort((i1, i2) => { return -(i1.id - i2.id); });
            for (const picture of picturesForPrompt) {
                // -- Add the picture --
                const item = new PictureElement(picture, {
                    prompt,
                    isPreferredSeed: isPreferredSeed(StaticDataProvider.entitiesHandler, projectId, picture.seed),
                    isLockable: project.lockable === true,
                    accept: async () => {
                        await StaticDataProvider.entitiesHandler.withTransaction(tr => {
                            tr.update("pictures", picture, {
                                status: asNamed(ComputationStatus.ACCEPTED)
                            });
                        });
                        item.refresh();
                        promptItem.refresh();
                        scrollToNextSibling(item);
                    },
                    reject: async () => {
                        await StaticDataProvider.entitiesHandler.withTransaction(tr => {
                            tr.update("pictures", picture, {
                                status: asNamed(ComputationStatus.REJECTED)
                            });
                        });
                        item.refresh();
                        promptItem.refresh();
                        scrollToNextSibling(item);
                    },
                    toggleSeed: async () => {
                        await StaticDataProvider.entitiesHandler.withTransaction(tr => {
                            togglePreferredSeed(StaticDataProvider.entitiesHandler, tr, projectId, picture.seed);
                        });
                        item._options.isPreferredSeed = isPreferredSeed(StaticDataProvider.entitiesHandler, projectId, picture.seed);
                        item.refresh();
                    },
                    toggleHighres: async () => {
                        // await this._cache.withData(async (data) => {
                        //     switch (picture.highresStatus) {
                        //         case ComputationStatus.REJECTED:
                        //         case ComputationStatus.ERROR:
                        //         case ComputationStatus.NONE:
                        //             await data.setPictureHighres(picture.id, true);
                        //             picture.highresStatus = ComputationStatus.PENDING;
                        //             break;
                        //         case ComputationStatus.PENDING:
                        //             await data.setPictureHighres(picture.id, false);
                        //             picture.highresStatus = ComputationStatus.NONE;
                        //             break;
                        //         case ComputationStatus.COMPUTING:
                        //         case ComputationStatus.DONE:
                        //             // No way to cancel from there
                        //             break;
                        //     }
                        // });
                        item.refresh();
                    },
                    setAsFeatured: async () => {
                        await StaticDataProvider.entitiesHandler.withTransaction(tr => {
                            tr.update("projects", project, {
                                featuredAttachmentId: picture.attachmentId
                            });
                        });
                    }
                });
                item.classList.add("col-sm-12", "col-md-6", "col-lg-4");
                this._picturesDiv.appendChild(item);
                item.refresh();
            }
        }

        // -- Auto display prompt panel ---------------------------------------
        if (prompts.length === 0) {
            this._openPromptPanel();
        } else {
            this._closePromptPanel();
        }

        // -- Scroll to top ---------------------------------------------------
        this._picturesDiv.scrollTo(0, 0);
    }

    protected _getFilter(preferredSeeds: Set<number>): (picture: PictureEntity) => boolean {
        let filter: (picture: PictureEntity) => boolean = function () { return true };
        const filterIndex = this._picturesFilterSelect.value;
        switch (filterIndex) {
            case "all":
                filter = function () { return true; }
                break;
            case "preferred":
                filter = function (picture) { return picture.status >= ComputationStatus.DONE && preferredSeeds.has(picture.seed); };
                break;
            case "done":
                filter = function (picture) { return picture.status === ComputationStatus.DONE; };
                break;
            case "accept":
                filter = function (picture) { return picture.status === ComputationStatus.ACCEPTED; };
                break;
            case "reject":
                filter = function (picture) { return picture.status === ComputationStatus.REJECTED; };
                break;
            default:
                console.error(`Invalid value : ${filterIndex}`)
        }
        return filter;
    }

    protected _onRefreshClick(): void {
        this.refresh();
        // Scroll to the top of the div
        this._picturesDiv.scrollTo(0, 0);
    }

    protected async _onZipClick(): Promise<void> {
        // const projectId = this._cache.getSelectedProjectId();
        // if (!projectId) {
        //     return;
        // }
        // try {
        //     const zip = await zipPictures({
        //         data: this._cache.data,
        //         projectId,
        //         filter: this._getFilter()
        //     });
        //     const blob = await zip.generateAsync({ type: "blob" });
        //     const a: HTMLAnchorElement = document.createElement("a");
        //     const url = window.URL.createObjectURL(blob);
        //     a.href = url;
        //     a.download = "pictures.zip";
        //     a.click();
        //     window.URL.revokeObjectURL(url);
        // } catch (e) {
        //     console.error(e);
        // }
    }

    protected async _onClearRejectedButtonClick(): Promise<void> {
        const projectId = StaticDataProvider.getSelectedProject();
        if (projectId == null) {
            return;
        }
        const projectPromptIds: Set<number> = new Set();
        for (const prompt of StaticDataProvider.entitiesHandler.getItems("prompts")) {
            if (prompt.projectId === projectId) {
                projectPromptIds.add(prompt.id);
            }
        }
        await StaticDataProvider.entitiesHandler.withTransaction((tr) => {
            for (const picture of StaticDataProvider.entitiesHandler.getItems("pictures")) {
                if (!projectPromptIds.has(picture.promptId)) {
                    continue;
                }

                if (picture.status === ComputationStatus.REJECTED || picture.status === ComputationStatus.ERROR) {
                    tr.delete("pictures", picture.id);
                    if (picture.attachmentId) {
                        tr.delete("attachments", picture.attachmentId);
                    }
                    if (picture.highresAttachmentId) {
                        tr.delete("attachments", picture.highresAttachmentId);
                    }
                }
            }
        });
        this.refresh();
    }

    protected _openPromptPanel(prompt?: PromptEntity): void {
        // -- Set fields --
        this._promptEditor.setPrompt(prompt);
        // -- Display the panel --
        this._promptCard.classList.remove("d-none");
    }

    protected _closePromptPanel(): void {
        this._promptCard.classList.add("d-none");
    }

    protected async _onNewPromptClick(): Promise<void> {
        const prompt = this._promptEditor.getPrompt();
        const projectId = StaticDataProvider.getSelectedProject();
        if (projectId != null) {
            let orderIndex: number = 1;
            for (const prompt of StaticDataProvider.entitiesHandler.getItems("prompts")) {
                if (prompt.projectId === projectId) {
                    orderIndex = Math.max(orderIndex, prompt.orderIndex + 1);
                }
            }
            await StaticDataProvider.entitiesHandler.withTransaction((tr) => {
                const newPrompt = tr.insert("prompts", {
                    ...prompt,
                    id: asNamed(0),
                    projectId,
                    orderIndex: asNamed(orderIndex)
                });
                // Create pictures for all preferred seeds
                generateNextPictures(StaticDataProvider.entitiesHandler, tr, newPrompt, null);
            });
            await this.refresh();
        }
        this._promptCard.classList.add("d-none");
    }
}

customElements.define("pictures-page", PicturesPage);
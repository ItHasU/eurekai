import { generateNextPicturesIfNeeded } from "@eurekai/shared/src/pictures.data";
import { BooleanEnum, ComputationStatus, PictureDTO, ProjectDTO, PromptDTO, SeedDTO } from "@eurekai/shared/src/types";
import { PictureElement } from "src/components/picture.element";
import { PromptElement } from "src/components/prompt.element";
import { showSelect } from "src/components/tools";
import { PromptEditor } from "src/editors/prompt.editor";
import { AbstractPageElement, DataProvider } from "./abstract.page.element";

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

    constructor(data: DataProvider) {
        super(require("./pictures.page.html").default, data);

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
        this._picturesFilterSelect.addEventListener("change", this.refresh.bind(this, false));
    }

    /** @inheritdoc */
    protected override async _refresh(): Promise<void> {
        // -- Make sure cache is updated --
        const projectId = this._data.getSelectedProject();
        if (projectId == null) {
            return;
        }

        await this._data.getSQLHandler().fetch({
            type: "project",
            options: {
                projectId
            }
        });

        // -- Clear --
        this._picturesDiv.innerHTML = "";

        // -- Fetch data --
        const project = this._data.getSQLHandler().getCache("projects").getById(projectId)
        const prompts = this._data.getSQLHandler().getCache("prompts").getItems().filter(prompt => prompt.projectId === projectId);
        const picturesRaw = this._data.getSQLHandler().getCache("pictures").getItems();

        const preferredSeeds: SeedDTO[] = [];//await this._cache.getSeeds();

        if (project == null) {
            // Nothing to display
            return;
        }

        const promptsMap: { [id: number]: PromptDTO } = {};
        for (const prompt of prompts) {
            promptsMap[prompt.id] = prompt;
        }

        let hasPromptDisplayed = false;
        const pictures = picturesRaw.filter(picture => {
            const prompt = promptsMap[picture.promptId];
            return prompt != null && prompt.projectId == projectId;
        });
        pictures.sort((p1, p2) => {
            let res = 0;

            if (res === 0) {
                const prompt1 = promptsMap[p1.promptId];
                const prompt2 = promptsMap[p2.promptId];
                if (prompt1 && prompt2) {
                    res = -(prompt1.orderIndex - prompt2.orderIndex);
                }
            }

            if (res === 0) {
                res = p1.status - p2.status;
            }

            if (res === 0) {
                res = p1.id - p2.id;
            }

            return res;
        });

        // -- Auto switch to accepted --
        // FIXME : Not working
        // if (!hasPendingPicture && this._picturesFilterSelect.value === "done") {
        // this._picturesFilterSelect.value = "accept";
        // }

        // -- Get the filter --
        let filter: (picture: PictureDTO) => boolean = this._getFilter();

        // -- Add prompt function --
        const addPrompt = (prompt: PromptDTO): void => {
            const promptItem = new PromptElement(prompt, {
                pictures: pictures.filter(p => p.promptId === prompt.id),
                start: async () => {
                    await this._data.getSQLHandler().withTransaction((tr) => {
                        tr.update("prompts", prompt, { active: BooleanEnum.TRUE });
                        generateNextPicturesIfNeeded(this._data.getSQLHandler(), tr, prompt);
                    });
                    promptItem.refresh();
                    // Won't refresh pictures, but we don't care
                },
                stop: async () => {
                    await this._data.getSQLHandler().withTransaction((tr) => {
                        tr.update("prompts", prompt, { active: BooleanEnum.FALSE });
                    });
                    promptItem.refresh();
                    // Won't refresh pictures, but we don't care
                },
                delete: async () => {
                    await this._data.getSQLHandler().withTransaction((tr) => {
                        tr.delete("prompts", prompt.id);
                        for (const picture of this._data.getSQLHandler().getItems("pictures")) {
                            if (picture.promptId === prompt.id) {
                                tr.delete("pictures", picture.id);
                            }
                        }
                    });
                    this.refresh();
                },
                move: async () => {
                    await this._data.getSQLHandler().fetch({ type: "projects", options: void (0) });
                    const projects = this._data.getSQLHandler().getItems("projects");
                    const selectedProject = await showSelect<ProjectDTO>(projects, {
                        valueKey: "id",
                        displayString: "name",
                        selected: projects.find(p => p.id === prompt.projectId)
                    });
                    if (selectedProject != null && selectedProject.id != prompt.projectId) {
                        await this._data.getSQLHandler().withTransaction((tr) => {
                            tr.update("prompts", prompt, { projectId: selectedProject.id });
                        });
                        this.refresh();
                    }
                },
                clone: this._openPromptPanel.bind(this, prompt)
            });
            promptItem.classList.add("col-12");
            promptItem.refresh();
            this._picturesDiv.appendChild(promptItem);
            hasPromptDisplayed = true;
        }

        // -- Fill the pictures --
        const displayedPromptIds: Set<number> = new Set();
        for (const picture of pictures) {
            if (!filter(picture)) {
                continue;
            }
            const prompt = promptsMap[picture.promptId];
            if (prompt == null) {
                // Should never happen since pictures are already filtered above
                // still it is safer to test it once again
                continue;
            }

            // -- Handle line breaks after each prompt --
            if (!displayedPromptIds.has(picture.promptId)) {
                displayedPromptIds.add(picture.promptId);
                // Add a line break
                const div = document.createElement("div");
                div.classList.add("w-100");
                this._picturesDiv.appendChild(div);

                // Add the prompt
                if (prompt) {
                    addPrompt(prompt);
                }
            }

            // -- Add the picture --
            const item = new PictureElement(picture, {
                prompt,
                isPreferredSeed: false, // preferredSeeds.has(picture.seed),
                isLockable: project?.lockable === BooleanEnum.TRUE,
                accept: async () => {
                    await this._data.getSQLHandler().withTransaction(tr => {
                        tr.update("pictures", picture, {
                            status: ComputationStatus.ACCEPTED
                        });
                        generateNextPicturesIfNeeded(this._data.getSQLHandler(), tr, prompt);
                    });
                    item.refresh();
                    scrollToNextSibling(item);
                },
                reject: async () => {
                    await this._data.getSQLHandler().withTransaction(tr => {
                        tr.update("pictures", picture, {
                            status: ComputationStatus.REJECTED
                        });
                        generateNextPicturesIfNeeded(this._data.getSQLHandler(), tr, prompt);
                    });
                    item.refresh();
                    scrollToNextSibling(item);
                },
                toggleSeed: async () => {
                    // await this._cache.withData(async (data) => {
                    //     await data.setSeedPreferred(prompt.projectId, picture.seed, !item._options.isPreferredSeed);
                    //     item._options.isPreferredSeed = !item._options.isPreferredSeed;
                    // });
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
                    await this._data.getSQLHandler().withTransaction(tr => {
                        tr.update("projects", project, {
                            featuredAttachmentId: picture.attachmentId
                        });
                    });
                },
                fetch: () => Promise.resolve("") //this._cache.data.getAttachment.bind(this._cache.data)
            });
            item.classList.add("col-sm-12", "col-md-6", "col-lg-4");
            this._picturesDiv.appendChild(item);
            item.refresh();
        }

        for (const prompt of prompts) {
            if (displayedPromptIds.has(prompt.id) || prompt.active === BooleanEnum.FALSE) {
                // Already displayed or not active anymore
                continue;
            } else {
                if (prompt.projectId === project.id) {
                    addPrompt(prompt);
                }
            }
        }
        if (!hasPromptDisplayed) {
            this._openPromptPanel();
        } else {
            this._closePromptPanel();
        }

        this._picturesDiv.scrollTo(0, 0);
    }

    protected _getFilter(): (picture: PictureDTO) => boolean {
        let filter: (picture: PictureDTO) => boolean = function () { return true };
        const filterIndex = this._picturesFilterSelect.value;
        switch (filterIndex) {
            case "done":
                filter = function (picture) { return picture.status === ComputationStatus.DONE; }
                break;
            case "accept":
                filter = function (picture) { return picture.status === ComputationStatus.ACCEPTED; }
                break;
            case "reject":
                filter = function (picture) { return picture.status === ComputationStatus.REJECTED; }
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

    protected _openPromptPanel(prompt?: PromptDTO): void {
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
        const projectId = this._data.getSelectedProject();
        if (projectId != null) {
            let orderIndex = 1;
            for (const prompt of this._data.getSQLHandler().getItems("prompts")) {
                if (prompt.projectId === projectId) {
                    orderIndex = Math.max(orderIndex, prompt.orderIndex + 1);
                }
            }
            await this._data.getSQLHandler().withTransaction((tr) => {
                const newPrompt = tr.insert("prompts", {
                    ...prompt,
                    id: 0,
                    projectId,
                    orderIndex,
                    active: BooleanEnum.TRUE
                });
                generateNextPicturesIfNeeded(this._data.getSQLHandler(), tr, newPrompt);
            });
            await this.refresh();
        }
        this._promptCard.classList.add("d-none");
    }
}

customElements.define("pictures-page", PicturesPage);
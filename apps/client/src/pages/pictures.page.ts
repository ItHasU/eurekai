import { BooleanEnum, ComputationStatus, HighresStatus, PictureDTO, ProjectDTO, PromptDTO } from "@eurekai/shared/src/types";
import { AbstractPageElement } from "./abstract.page.element";
import { PictureElement } from "src/components/picture.element";
import { zipPictures } from "@eurekai/shared/src/utils";
import { PromptElement } from "src/components/prompt.element";
import { DataCache } from "@eurekai/shared/src/cache";
import { showSelect } from "src/components/tools";
import { Modal } from "bootstrap";

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
    protected readonly _positiveInput: HTMLInputElement;
    protected readonly _negativeInput: HTMLInputElement;
    protected readonly _bufferSizeInput: HTMLInputElement;
    protected readonly _promptCard: HTMLDivElement;

    constructor(cache: DataCache) {
        super(require("./pictures.page.html").default, cache);

        // -- Get components --
        this._picturesDiv = this.querySelector("#picturesDiv") as HTMLDivElement;
        this._picturesFilterSelect = this.querySelector("#picturesFilterSelect") as HTMLSelectElement;

        this._promptCard = this.querySelector("#promptCard") as HTMLDivElement;
        this._positiveInput = this.querySelector("#positiveInput") as HTMLInputElement;
        this._negativeInput = this.querySelector("#negativeInput") as HTMLInputElement;
        this._bufferSizeInput = this.querySelector("#bufferSizeInput") as HTMLInputElement;

        // -- Bind callbacks for buttons --
        this._bindClickForRef("addPromptButton", this._openPromptPanel.bind(this));
        this._bindClickForRef("closePromptButton", this._closePromptPanel.bind(this));
        this._bindClickForRef("newPromptButton", this._onNewPromptClick.bind(this));
        this._bindClickForRef("zipButton", this._onZipClick.bind(this));
        this._picturesFilterSelect.addEventListener("change", this.refresh.bind(this, false));
    }

    /** @inheritdoc */
    protected override async _refresh(): Promise<void> {
        const prompts = await this._cache.getPrompts();
        const picturesRaw = await this._cache.getPictures();
        const preferredSeeds = await this._cache.getSeeds();
        const project = await this._cache.getSelectedProject();

        if (prompts.length === 0) {
            this._openPromptPanel();
        }

        const promptsMap: { [id: number]: PromptDTO } = {};
        for (const prompt of prompts) {
            promptsMap[prompt.id] = prompt;
        }

        const pictures = [...picturesRaw];
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
                res = p1.createdAt - p2.createdAt;
            }

            if (res === 0) {
                res = p1.computed - p2.computed;
            }

            if (res === 0) {
                res = p1.id - p2.id;
            }

            return res;
        });

        // -- Get the filter --
        let filter: (picture: PictureDTO) => boolean = this._getFilter();

        // -- Clear --
        this._picturesDiv.innerHTML = "";

        // -- Add prompt function --
        const addPrompt = (prompt: PromptDTO): void => {
            const promptItem = new PromptElement(prompt, {
                pictures: pictures.filter(p => p.promptId === prompt.id),
                start: async () => {
                    await this._cache.withData(async (data) => {
                        await data.setPromptActive(prompt.id, true);
                        prompt.active = true;
                    });
                    promptItem.refresh();
                    // Won't refresh pictures, but we don't care
                },
                stop: async () => {
                    await this._cache.withData(async (data) => {
                        await data.setPromptActive(prompt.id, false);
                        prompt.active = false;
                    });
                    promptItem.refresh();
                    // Won't refresh pictures, but we don't care
                },
                delete: async () => {
                    await this._cache.withData(async (data) => {
                        await data.movePrompt(prompt.id, null);
                    });
                    promptItem.remove();
                },
                move: async () => {
                    await this._cache.withData(async (data) => {
                        const projects = await data.getProjects();
                        const selectedProject = await showSelect<ProjectDTO>(projects, {
                            valueKey: "id",
                            displayString: "name",
                            selected: projects.find(p => p.id === prompt.projectId)
                        });
                        if (selectedProject != null && selectedProject.id != prompt.projectId) {
                            await data.movePrompt(prompt.id, selectedProject.id);
                            promptItem.remove();
                        }
                    });
                },
                clone: this._openPromptPanel.bind(this, prompt)
            });
            promptItem.classList.add("col-12");
            promptItem.refresh();
            this._picturesDiv.appendChild(promptItem);
        }

        // -- Fill the pictures --
        const picturesDiv = this.querySelector("#picturesDiv") as HTMLDivElement;
        const displayedPromptIds: Set<number> = new Set();
        for (const picture of pictures) {
            if (!filter(picture)) {
                continue;
            }
            const prompt = promptsMap[picture.promptId];

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
                isPreferredSeed: preferredSeeds.has(picture.options.seed),
                isLockable: project?.lockable === BooleanEnum.TRUE,
                accept: async () => {
                    await this._cache.withData(async (data) => {
                        await data.setPictureStatus(picture.id, ComputationStatus.ACCEPTED);
                        picture.computed = ComputationStatus.ACCEPTED;
                    });
                    item.refresh();
                    scrollToNextSibling(item);
                },
                reject: async () => {
                    await this._cache.withData(async (data) => {
                        await data.setPictureStatus(picture.id, ComputationStatus.REJECTED);
                        picture.computed = ComputationStatus.REJECTED;
                    });
                    item.refresh();
                    scrollToNextSibling(item);
                },
                start: async () => {
                    await this._cache.withData(async (data) => {
                        await data.setPromptActive(picture.promptId, true);
                        if (prompt) { prompt.active = true; }
                    });
                    item.refresh();
                },
                stop: async () => {
                    await this._cache.withData(async (data) => {
                        await data.setPromptActive(picture.promptId, false);
                        if (prompt) { prompt.active = false; }
                    });
                    item.refresh();
                },
                toggleSeed: async () => {
                    await this._cache.withData(async (data) => {
                        await data.setSeedPreferred(picture.projectId, picture.options.seed, !item._options.isPreferredSeed);
                        item._options.isPreferredSeed = !item._options.isPreferredSeed;
                    });
                    item.refresh();
                },
                toggleHighres: async () => {
                    await this._cache.withData(async (data) => {
                        switch (picture.highres) {
                            case HighresStatus.DELETED:
                            case HighresStatus.ERROR:
                            case HighresStatus.NONE:
                                await data.setPictureHighres(picture.id, true);
                                picture.highres = HighresStatus.PENDING;
                                break;
                            case HighresStatus.PENDING:
                                await data.setPictureHighres(picture.id, false);
                                picture.highres = HighresStatus.NONE;
                                break;
                            case HighresStatus.COMPUTING:
                            case HighresStatus.DONE:
                                // No way to cancel from there
                                break;
                        }
                    });
                    item.refresh();
                },
                setAsFeatured: async () => {
                    await this._cache.withData(async (data) => {
                        await data.setProjectFeaturedImage(picture.projectId, picture.attachmentId ?? null);
                    });
                },
                fetch: this._cache.data.getAttachment.bind(this._cache.data)
            });
            item.classList.add("col-sm-12", "col-md-6", "col-lg-4");
            picturesDiv.appendChild(item);
            item.refresh();
        }

        for (const prompt of prompts) {
            if (displayedPromptIds.has(prompt.id) || !prompt.active) {
                continue;
            } else {
                addPrompt(prompt);
            }
        }

        picturesDiv.scrollTo(0, 0);
    }

    protected _getFilter(): (picture: PictureDTO) => boolean {
        let filter: (picture: PictureDTO) => boolean = function () { return true };
        const filterIndex = this._picturesFilterSelect.value;
        switch (filterIndex) {
            case "done":
                filter = function (picture) { return picture.computed === ComputationStatus.DONE; }
                break;
            case "accept":
                filter = function (picture) { return picture.computed === ComputationStatus.ACCEPTED; }
                break;
            case "reject":
                filter = function (picture) { return picture.computed === ComputationStatus.REJECTED; }
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
        const projectId = this._cache.getSelectedProjectId();
        if (!projectId) {
            return;
        }
        try {
            const zip = await zipPictures({
                data: this._cache.data,
                projectId,
                filter: this._getFilter()
            });
            const blob = await zip.generateAsync({ type: "blob" });
            const a: HTMLAnchorElement = document.createElement("a");
            const url = window.URL.createObjectURL(blob);
            a.href = url;
            a.download = "pictures.zip";
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            console.error(e);
        }
    }

    protected _openPromptPanel(prompt?: PromptDTO): void {
        // -- Set all fields to passed prompt --
        this._positiveInput.value = prompt?.prompt ?? "";
        this._negativeInput.value = prompt?.negative_prompt ?? "";
        this._bufferSizeInput.value = "" + (prompt?.acceptedTarget ?? 10);

        // -- Display the panel --
        this._promptCard.classList.remove("d-none");
    }

    protected _closePromptPanel(): void {
        this._promptCard.classList.add("d-none");
    }

    protected async _onNewPromptClick(): Promise<void> {
        const positivePrompt = this._positiveInput.value;
        const negativePrompt = this._negativeInput.value;
        const bufferSize = +this._bufferSizeInput.value;
        const acceptedTarget = 0;
        const projectId = this._cache.getSelectedProjectId();
        if (projectId != null) {
            await this._cache.withData(async (data) => {
                await data.addPrompt({
                    projectId: projectId,
                    prompt: positivePrompt,
                    negative_prompt: negativePrompt,
                    active: true,
                    bufferSize,
                    acceptedTarget
                });
            });
            await this.refresh();
        }
        this._promptCard.classList.add("d-none");
    }
}

customElements.define("pictures-page", PicturesPage);
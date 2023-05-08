import { ComputationStatus, PictureDTO, ProjectDTO, PromptDTO } from "@eurekai/shared/src/types";
import { AbstractPageElement } from "./abstract.page.element";
import { AbstractDataWrapper } from "@eurekai/shared/src/data";
import { PictureElement } from "src/components/picture.element";
import { zipPictures } from "@eurekai/shared/src/utils";
import { PromptElement } from "src/components/prompt.element";

function scrollToNextSibling(node: HTMLElement): void {
    const parent = node.parentElement;
    if (!parent) {
        return;
    }

    const next = node.nextElementSibling;
    if (next) {
        next.scrollIntoView();
    } else {
        // We are done
    }
}

/** Display projects and fire an event on project change */
export class PicturesPage extends AbstractPageElement {

    protected _projectId: number | null = null;
    protected _prompts: PromptDTO[] = [];
    protected _pictures: PictureDTO[] = [];

    protected readonly _picturesDiv: HTMLDivElement;
    protected readonly _picturesFilterSelect: HTMLSelectElement;
    protected readonly _refreshButton: HTMLButtonElement;
    protected readonly _zipButton: HTMLButtonElement;

    constructor(protected _data: AbstractDataWrapper) {
        super(require("./pictures.page.html").default);

        // -- Get components --
        this._picturesDiv = this.querySelector("#picturesDiv") as HTMLDivElement;
        this._picturesFilterSelect = this.querySelector("#picturesFilterSelect") as HTMLSelectElement;
        this._refreshButton = this.querySelector("#refreshButton") as HTMLButtonElement;
        this._zipButton = this.querySelector("#zipButton") as HTMLButtonElement;

        // -- Bind callbacks --
        this._picturesFilterSelect.addEventListener("change", this.refresh.bind(this));
        this._refreshButton.addEventListener("click", this.refresh.bind(this));
        this._zipButton.addEventListener("click", this._onZipClick.bind(this));
    }

    /** For the template */
    public get prompts(): PromptDTO[] {
        return this._prompts;
    }

    /** For the template */
    public get pictures(): PictureDTO[] {
        return this._pictures;
    }

    /** Set the project and refresh the page */
    public async setProjectId(id: number): Promise<void> {
        this._projectId = id;
        await this.refresh();
    }

    /** @inheritdoc */
    protected override async _loadData(): Promise<void> {
        this._prompts = this._projectId == null ? [] : await this._data.getPrompts(this._projectId);
        this._pictures = this._projectId == null ? [] : await this._data.getPictures(this._projectId);
    }

    /** @inheritdoc */
    protected override _postRender(): Promise<void> {
        const promptsMap: { [id: number]: PromptDTO } = {};
        for (const prompt of this._prompts) {
            promptsMap[prompt.id] = prompt;
        }

        const pictures = [...this._pictures];
        pictures.sort((p1, p2) => {
            let res = 0;

            if (res === 0) {
                const prompt1 = promptsMap[p1.promptId];
                const prompt2 = promptsMap[p2.promptId];
                if (prompt1 && prompt2) {
                    res = prompt1.orderIndex - prompt2.orderIndex;
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

        // -- Fill the pictures --
        const picturesDiv = this.querySelector("#picturesDiv") as HTMLDivElement;
        let previousPromptId: number | null = null;
        for (const picture of pictures) {
            if (!filter(picture)) {
                continue;
            }
            const prompt = promptsMap[picture.promptId];

            // -- Handle line breaks after each prompt --
            if (previousPromptId !== picture.promptId) {
                // Add a line break
                const div = document.createElement("div");
                div.classList.add("w-100");
                this._picturesDiv.appendChild(div);

                // Add the prompt
                if (prompt) {
                    const promptItem = new PromptElement(prompt, {
                        start: async () => {
                            await this._data.setPromptActive(picture.promptId, true);
                            prompt.active = true;
                            promptItem.refresh();
                            // Won't refresh pictures, but we don't care
                        },
                        stop: async () => {
                            await this._data.setPromptActive(picture.promptId, false);
                            prompt.active = false;
                            promptItem.refresh();
                            // Won't refresh pictures, but we don't care
                        }
                    });
                    promptItem.classList.add("col-12");
                    promptItem.refresh();
                    this._picturesDiv.appendChild(promptItem);
                }
            }
            previousPromptId = picture.promptId;

            // -- Add the picture --
            const item = new PictureElement(picture, prompt, {
                accept: async () => {
                    await this._data.setPictureStatus(picture.id, ComputationStatus.ACCEPTED);
                    picture.computed = ComputationStatus.ACCEPTED;
                    item.refresh();
                    scrollToNextSibling(item);
                },
                reject: async () => {
                    await this._data.setPictureStatus(picture.id, ComputationStatus.REJECTED);
                    picture.computed = ComputationStatus.REJECTED;
                    item.refresh();
                    scrollToNextSibling(item);
                },
                start: async () => {
                    await this._data.setPromptActive(picture.promptId, true);
                    if (prompt) { prompt.active = true; }
                    item.refresh();
                },
                stop: async () => {
                    await this._data.setPromptActive(picture.promptId, false);
                    if (prompt) { prompt.active = false; }
                    item.refresh();
                },
                fetch: this._data.getAttachment.bind(this._data)
            });
            item.classList.add("col-xs-12", "col-sm-6", "col-md-4", "col-lg-3", "col-xxl-2");
            item.refresh();
            picturesDiv.appendChild(item);
        }

        // -- Bind callbacks for buttons --
        return Promise.resolve();
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

    protected async _onZipClick(): Promise<void> {
        if (!this._projectId) {
            return;
        }
        try {
            const zip = await zipPictures({
                data: this._data,
                projectId: this._projectId,
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

}

customElements.define("pictures-page", PicturesPage);
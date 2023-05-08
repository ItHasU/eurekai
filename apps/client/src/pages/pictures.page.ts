import { ComputationStatus, PictureDTO, ProjectDTO, PromptDTO } from "@eurekai/shared/src/types";
import { AbstractPageElement } from "./abstract.page.element";
import { AbstractDataWrapper } from "@eurekai/shared/src/data";
import { PromptElement } from "src/components/prompt.element";
import { PictureElement } from "src/components/picture.element";

/** Display projects and fire an event on project change */
export class PicturesPage extends AbstractPageElement {

    protected _projectId: number | null = null;
    protected _prompts: PromptDTO[] = [];
    protected _pictures: PictureDTO[] = [];

    protected readonly _picturesDiv: HTMLDivElement;
    protected readonly _picturesFilterSelect: HTMLSelectElement;

    constructor(protected _data: AbstractDataWrapper) {
        super(require("./pictures.page.html").default);
        
        // -- Get components --
        this._picturesDiv = this.querySelector("#picturesDiv") as HTMLDivElement;
        this._picturesFilterSelect = this.querySelector("#picturesFilterSelect") as HTMLSelectElement;

        // -- Bind callbacks --
        this._picturesFilterSelect.addEventListener("change", this.refresh.bind(this));
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
                res = p1.createdAt - p2.createdAt;
            }

            if (res === 0) {
                const prompt1 = promptsMap[p1.promptId];
                const prompt2 = promptsMap[p2.promptId];
                if (prompt1 && prompt2) {
                    res = prompt1.index - prompt2.index;
                }
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
        for (const picture of pictures) {
            if (!filter(picture)) {
                continue;
            }
            const prompt = this._prompts.find(p => p.id === picture.promptId);
            const item = new PictureElement(picture, prompt, {
                accept: async () => {
                    await this._data.setPictureStatus(picture.id, ComputationStatus.ACCEPTED);
                    picture.computed = ComputationStatus.ACCEPTED;
                    item.refresh();
                },
                reject: async () => {
                    await this._data.setPictureStatus(picture.id, ComputationStatus.REJECTED);
                    picture.computed = ComputationStatus.REJECTED;
                    item.refresh();
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

}

customElements.define("pictures-page", PicturesPage);
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

    constructor(protected _data: AbstractDataWrapper) {
        super(require("./pictures.page.html").default);
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
        // -- Fill the pictures --
        const picturesDiv = this.querySelector("#picturesDiv") as HTMLDivElement;
        for (const picture of this._pictures) {
            const prompt = this._prompts.find(p => p.id === picture.promptId);
            const item = new PictureElement(picture, prompt, {
                accept: async () => {
                    await this._data.setPictureStatus(picture.id, ComputationStatus.ACCEPTED);
                    await this.refresh();
                },
                reject: async () => {
                    await this._data.setPictureStatus(picture.id, ComputationStatus.REJECTED);
                    await this.refresh();
                },
                start: async () => {
                    await this._data.setPromptActive(picture.promptId, true);
                    await this.refresh();
                },
                stop: async () => {
                    await this._data.setPromptActive(picture.promptId, false);
                    await this.refresh();
                },
                fetch: this._data.getAttachment.bind(this._data)
            });
            item.refresh();
            picturesDiv.appendChild(item);
        }

        // -- Bind callbacks for buttons --
        // TODO
        return Promise.resolve();
    }

}

customElements.define("pictures-page", PicturesPage);
import { PictureDTO, ProjectDTO, PromptDTO } from "@eurekai/shared/src/types";
import { AbstractPageElement } from "./abstract.page.element";
import { AbstractDataWrapper } from "@eurekai/shared/src/data";
import { PromptElement } from "src/components/prompt.element";

/** Display projects and fire an event on project change */
export class PromptsPage extends AbstractPageElement {

    protected _projectId: number | null = null;
    protected _prompts: PromptDTO[] = [];
    protected _picturesPerPromptId: { [promptId: number]: PictureDTO[] } = {};

    protected readonly _promptsDiv: HTMLDivElement;
    protected readonly _positiveInput: HTMLInputElement;
    protected readonly _negativeInput: HTMLInputElement;
    protected readonly _bufferSizeInput: HTMLInputElement;
    protected readonly _targetAcceptedInput: HTMLInputElement;

    constructor(protected _data: AbstractDataWrapper) {
        super(require("./prompts.page.html").default);

        this._promptsDiv = this.querySelector("#promptsDiv") as HTMLDivElement;
        this._positiveInput = this.querySelector("#positiveInput") as HTMLInputElement;
        this._negativeInput = this.querySelector("#negativeInput") as HTMLInputElement;
        this._bufferSizeInput = this.querySelector("#bufferSizeInput") as HTMLInputElement;
        this._targetAcceptedInput = this.querySelector("#targetAcceptedInput") as HTMLInputElement;

        // -- Bind callbacks for buttons --
        this._bindClick("queueButton", this._onQueueClick.bind(this));
        this._bindClick("refreshButton", this.refresh.bind(this));
    }

    /** For the template */
    public get prompts(): PromptDTO[] {
        return this._prompts;
    }

    /** Set the project and refresh the page */
    public async setProjectId(id: number): Promise<void> {
        this._projectId = id;
        await this.refresh();
    }

    /** @inheritdoc */
    protected override async _loadData(): Promise<void> {
        this._prompts = this._projectId == null ? [] : await this._data.getPrompts(this._projectId);
        const pictures = this._projectId == null ? [] : await this._data.getPictures(this._projectId);
        this._picturesPerPromptId = {};
        for (const picture of pictures) {
            if (this._picturesPerPromptId[picture.promptId] == null) {
                this._picturesPerPromptId[picture.promptId] = [];
            }
            this._picturesPerPromptId[picture.promptId].push(picture);
        }
    }

    /** @inheritdoc */
    protected override _postRender(): Promise<void> {
        // -- Fill prompts --
        this._promptsDiv.innerHTML = "";
        for (const prompt of this._prompts) {
            // Create the components for each prompt
            const item = new PromptElement(prompt, {
                pictures: this._picturesPerPromptId[prompt.id] ?? [],
                start: async () => {
                    await this._data.setPromptActive(prompt.id, true);
                    prompt.active = true;
                    item.refresh();
                },
                stop: async () => {
                    await this._data.setPromptActive(prompt.id, false);
                    prompt.active = false;
                    item.refresh();
                },
                clone: () => {
                    this._positiveInput.value = prompt.prompt;
                    this._negativeInput.value = prompt.negative_prompt ?? "";
                    this._bufferSizeInput.value = "" + prompt.bufferSize;
                    this._targetAcceptedInput.value = "" + prompt.acceptedTarget;
                }
            });
            item.classList.add("col-md-4");
            item.refresh();
            this._promptsDiv.appendChild(item);
        }

        return Promise.resolve();
    }

    /** Add queue button callback */
    protected async _onQueueClick(): Promise<void> {
        const positivePrompt = this._positiveInput.value;
        const negativePrompt = this._negativeInput.value;
        const bufferSize = +this._bufferSizeInput.value;
        const acceptedTarget = +this._targetAcceptedInput.value;
        await this._data.addPrompt({
            projectId: this._projectId!,
            prompt: positivePrompt,
            negative_prompt: negativePrompt,
            active: true,
            bufferSize,
            acceptedTarget
        });
        await this.refresh();
    }



}

customElements.define("prompts-page", PromptsPage);
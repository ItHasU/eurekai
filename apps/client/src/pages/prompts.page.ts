import { ProjectDTO, PromptDTO } from "@eurekai/shared/src/types";
import { AbstractPageElement } from "./abstract.page.element";
import { AbstractDataWrapper } from "@eurekai/shared/src/data";
import { PromptElement } from "src/components/prompt.element";

/** Display projects and fire an event on project change */
export class PromptsPage extends AbstractPageElement {

    protected _projectId: number | null = null;
    protected _prompts: PromptDTO[] = [];

    constructor(protected _data: AbstractDataWrapper) {
        super(require("./prompts.page.html").default);
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
    }

    /** @inheritdoc */
    protected override _postRender(): Promise<void> {
        // -- Fill prompts --
        const promptsDiv = this.querySelector("#promptsDiv") as HTMLDivElement;
        // No need to clean, it has just been rendered
        for (const prompt of this._prompts) {
            // Create the components for each prompt
            const item = new PromptElement(prompt, {
                accept: async () => {
                    await this._data.setPromptActive(prompt.id, true);
                    await this.refresh();
                },
                reject: async () => {
                    await this._data.setPromptActive(prompt.id, false);
                    await this.refresh();
                },
                clone: () => {
                    // TODO 
                }
            });
            item.refresh();
            promptsDiv.appendChild(item);
        }

        // -- Bind callbacks for buttons --
        this._bindClick("queueButton", this._onQueueClick.bind(this));
        return Promise.resolve();
    }

    /** Add queue button callback */
    protected async _onQueueClick(): Promise<void> {
        const positiveInput = this.querySelector("#positiveInput") as HTMLInputElement;
        const negativeInput = this.querySelector("#negativeInput") as HTMLInputElement;
        const bufferSizeInput = this.querySelector("#bufferSizeInput") as HTMLInputElement;
        const targetAcceptedInput = this.querySelector("#targetAcceptedInput") as HTMLInputElement;

        const positivePrompt = positiveInput.value;
        const negativePrompt = negativeInput.value;
        const bufferSize = +bufferSizeInput.value;
        const acceptedTarget = +targetAcceptedInput.value;
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
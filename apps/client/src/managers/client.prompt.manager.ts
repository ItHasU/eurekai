import { PromptsWrapper } from "@eurekai/shared/src/prompts.wrapper";
import { PromptElement } from "src/components/prompt.element";

export class ClientPromptManager {
    
    // -- Main form --
    protected readonly _positiveInput: HTMLInputElement;
    protected readonly _negativeInput: HTMLInputElement;
    protected readonly _bufferSizeInput: HTMLInputElement;
    protected readonly _targetAcceptedInput: HTMLInputElement;
    protected readonly _queueButton: HTMLButtonElement;
    protected readonly _cleanButton: HTMLButtonElement;

    // -- Prompt divs --
    protected readonly _promptsDiv: HTMLDivElement;
    protected _promptsCache: { [_id: string]: PromptElement } = {};

    constructor(protected readonly _prompts: PromptsWrapper) {
        this._prompts.addChangeListener(this._refresh.bind(this));

        // -- Get components --
        this._positiveInput = document.getElementById("positiveInput") as HTMLInputElement;
        this._negativeInput = document.getElementById("negativeInput") as HTMLInputElement;
        this._bufferSizeInput = document.getElementById("bufferSizeInput") as HTMLInputElement;
        this._targetAcceptedInput = document.getElementById("targetAcceptedInput") as HTMLInputElement;
        this._promptsDiv = document.getElementById("promptsDiv") as HTMLDivElement;
        this._queueButton = document.getElementById("queueButton") as HTMLButtonElement;
        this._cleanButton = document.getElementById("cleanPromptsButton") as HTMLButtonElement;

        // -- Bind callbacks for buttons --
        this._queueButton.addEventListener("click", this._onQueueClick.bind(this));
        this._cleanButton.addEventListener("click", this._onCleanClick.bind(this));

        this._refresh();
    }

    /** Refresh prompts */
    protected async _refresh(): Promise<void> {
        try {
            // -- Get images --
            const prompts = await this._prompts.getAll();

            prompts.sort((p1, p2) => {
                let res = 0;

                if (res === 0) {
                    res = -(p1.index - p2.index);
                }

                return res;
            });

            // -- Clear --
            this._promptsDiv.innerHTML = "";
            // -- Render --
            for (const prompt of prompts) {
                const existing: PromptElement | undefined = this._promptsCache[prompt._id];
                if (existing == null) {
                    // Not existing yet
                    const element = new PromptElement(prompt, {
                        accept: async () => {
                            await this._prompts.toggle(prompt, true);
                            this._refresh();
                        },
                        reject: async () => {
                            await this._prompts.toggle(prompt, false);
                            this._refresh();
                        },
                        clone: () => {
                            this._positiveInput.value = prompt.prompt;
                            this._negativeInput.value = prompt.negative_prompt ?? "";
                            this._bufferSizeInput.value = "" + prompt.bufferSize;
                            this._targetAcceptedInput.value = "" + prompt.acceptedTarget;
                        }
                    });
                    this._promptsDiv.append(element);
                    element.refresh();
                } else {
                    // Existing
                    existing.setData(prompt); // Maybe image has been updated
                    this._promptsDiv.append(existing);
                }
            }
        } catch (e) {
            console.error(e);
        }

    }

    /** Add queue button callback */
    protected async _onQueueClick(): Promise<void> {
        const positivePrompt = this._positiveInput.value;
        const negativePrompt = this._negativeInput.value;
        const bufferSize = +this._bufferSizeInput.value;
        const targetAccepted = +this._targetAcceptedInput.value;
        await this._prompts.push(positivePrompt, negativePrompt ? negativePrompt : undefined, bufferSize, targetAccepted);
    }

    protected _onCleanClick(): Promise<void> {
        this._promptsCache = {};
        return this._prompts.clean();
    }

}
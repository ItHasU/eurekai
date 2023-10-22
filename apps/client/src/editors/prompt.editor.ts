import { PromptDTO } from "@eurekai/shared/src/types";

export class PromptEditor extends HTMLElement {

    protected readonly _positiveInput: HTMLInputElement;
    protected readonly _negativeInput: HTMLInputElement;
    protected readonly _bufferSizeInput: HTMLInputElement;

    constructor() {
        super();
        this.innerHTML = require("./prompt.editor.html").default;

        this._positiveInput = this.querySelector("#positiveInput") as HTMLInputElement;
        this._negativeInput = this.querySelector("#negativeInput") as HTMLInputElement;
        this._bufferSizeInput = this.querySelector("#bufferSizeInput") as HTMLInputElement;
    }

    public setPrompt(prompt?: PromptDTO): void {
        // -- Set all fields to passed prompt --
        this._positiveInput.value = prompt?.prompt ?? "";
        this._negativeInput.value = prompt?.negative_prompt ?? "";
        this._bufferSizeInput.value = "" + (prompt?.bufferSize ?? 10);
    }

    public getPrompt(): Omit<PromptDTO, "id" | "projectId" | "orderIndex" | "active"> {
        // -- Read values --
        const positivePrompt = this._positiveInput.value;
        const negativePrompt = this._negativeInput.value;
        const bufferSize = +this._bufferSizeInput.value;

        // -- Build object --
        return {
            prompt: positivePrompt,
            negative_prompt: negativePrompt ? negativePrompt : undefined,
            bufferSize,

            width: 512,
            height: 512,
            model: ""
        };
    }

}

customElements.define("editor-prompt", PromptEditor);

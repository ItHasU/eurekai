import { PromptDTO } from "@eurekai/shared/src/types";
import { htmlStringToElement } from "src/components/tools";

type Ratio = { width: number, height: number };
const RATIOS: Ratio[] = [
    { width: 21, height: 9 },
    { width: 16, height: 9 },
    { width: 4, height: 3 },
    { width: 1, height: 1 },
    { width: 3, height: 4 },
    { width: 9, height: 16 },
    { width: 9, height: 21 }
];
const SIZE = 1024;

export class PromptEditor extends HTMLElement {

    protected readonly _positiveInput: HTMLInputElement;
    protected readonly _negativeInput: HTMLInputElement;
    protected readonly _bufferSizeInput: HTMLInputElement;
    protected readonly _widthInput: HTMLInputElement;
    protected readonly _heightInput: HTMLInputElement;
    protected readonly _ratioSelect: HTMLUListElement;

    constructor() {
        super();
        this.innerHTML = require("./prompt.editor.html").default;

        this._positiveInput = this.querySelector("#positiveInput") as HTMLInputElement;
        this._negativeInput = this.querySelector("#negativeInput") as HTMLInputElement;
        this._bufferSizeInput = this.querySelector("#bufferSizeInput") as HTMLInputElement;
        this._widthInput = this.querySelector("#widthInput") as HTMLInputElement;
        this._heightInput = this.querySelector("#heightInput") as HTMLInputElement;
        this._ratioSelect = this.querySelector("#ratioSelect") as HTMLUListElement;

        for (const ratio of RATIOS) {
            const item = htmlStringToElement<HTMLLIElement>(`<li><a class="dropdown-item">${ratio.width}:${ratio.height}</a></li>`)!;
            item.querySelector("a")?.addEventListener("click", (evt) => {
                evt.stopPropagation();
                const factor = Math.sqrt(ratio.width / ratio.height);
                const w = Math.round(SIZE * factor / 8) * 8;
                const h = Math.round(SIZE / factor / 8) * 8;
                this._widthInput.value = "" + w;
                this._heightInput.value = "" + h;
            });
            this._ratioSelect.append(item);
        }
    }

    public setPrompt(prompt?: PromptDTO): void {
        // -- Set all fields to passed prompt --
        this._positiveInput.value = prompt?.prompt ?? "";
        this._negativeInput.value = prompt?.negative_prompt ?? "";
        this._bufferSizeInput.value = "" + (prompt?.bufferSize ?? 10);
        this._widthInput.value = "" + (prompt?.width ?? 1024);
        this._heightInput.value = "" + (prompt?.height ?? 1024);
    }

    public getPrompt(): Omit<PromptDTO, "id" | "projectId" | "orderIndex" | "active"> {
        // -- Read values --
        const positivePrompt = this._positiveInput.value;
        const negativePrompt = this._negativeInput.value;
        const bufferSize = +this._bufferSizeInput.value;
        const width = +this._widthInput.value;
        const height = +this._heightInput.value;

        // -- Build object --
        return {
            prompt: positivePrompt,
            negative_prompt: negativePrompt ? negativePrompt : undefined,
            bufferSize,

            width,
            height,
            model: "SDXL juggernautXL_version6Rundiffusion.safetensors [1fe6c7ec54] + sd_xl_refiner_1.0_0.9vae.safetensors [8d0ce6c016]"
        };
    }

}

customElements.define("editor-prompt", PromptEditor);

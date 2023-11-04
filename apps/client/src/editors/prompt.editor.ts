import { apiCall } from "@dagda/client/api";
import { MODELS_URL, ModelsAPI } from "@eurekai/shared/src/models.api";
import { PromptDTO } from "@eurekai/shared/src/types";
import { htmlStringToElement } from "src/components/tools";
import { StaticDataProvider } from "src/tools/dataProvider";

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
const DEFAULT_SIZE = 1024;

export class PromptEditor extends HTMLElement {

    protected readonly _positiveInput: HTMLInputElement;
    protected readonly _negativeInput: HTMLInputElement;
    protected readonly _bufferSizeInput: HTMLInputElement;
    protected readonly _widthInput: HTMLInputElement;
    protected readonly _heightInput: HTMLInputElement;
    protected readonly _ratioSelect: HTMLUListElement;
    protected readonly _modelsSelect: HTMLSelectElement;
    protected readonly _modelsButton: HTMLButtonElement;

    constructor() {
        super();
        this.innerHTML = require("./prompt.editor.html").default;

        this._positiveInput = this.querySelector("#positiveInput") as HTMLInputElement;
        this._negativeInput = this.querySelector("#negativeInput") as HTMLInputElement;
        this._bufferSizeInput = this.querySelector("#bufferSizeInput") as HTMLInputElement;
        this._widthInput = this.querySelector("#widthInput") as HTMLInputElement;
        this._heightInput = this.querySelector("#heightInput") as HTMLInputElement;
        this._ratioSelect = this.querySelector("#ratioSelect") as HTMLUListElement;
        this._modelsSelect = this.querySelector("#modelsSelect") as HTMLSelectElement;
        this._modelsButton = this.querySelector("#modelsButton") as HTMLButtonElement;

        this._fillRatios(DEFAULT_SIZE); // Use default size while model is not selected

        this._fillModelsSelect();
        this._modelsButton.addEventListener("click", this._fillModelsSelect.bind(this, true));
        this._modelsSelect.addEventListener("change", this._onModelsChange.bind(this));
    }

    //#region Models ----------------------------------------------------------

    protected _fillModelsSelect(forceRefresh: boolean = false): void {
        apiCall<ModelsAPI, "getModels">(MODELS_URL, "getModels", forceRefresh).then((models) => {
            this._modelsSelect.innerHTML = '';
            for (const model of models) {
                const option = `<option value="${model.uid}">${model.displayName}</option>`;
                this._modelsSelect.innerHTML += option;
            }
        }).catch(e => {
            console.error(e);
            this._modelsSelect.innerHTML = '<option value="">!Error!</option>';
        });
    }

    protected async _onModelsChange(): Promise<void> {
        const uid = this._modelsSelect.value;
        const model = (await StaticDataProvider.getModels()).find(info => info.uid === uid);
        if (model == null) {
            // Model not found, use default value
            this._fillRatios(DEFAULT_SIZE);
        } else {
            this._fillRatios(model.size);
        }
    }

    //#endregion

    //#region Ratios ----------------------------------------------------------

    protected _fillRatios(size: number): void {
        this._ratioSelect.innerHTML = '';
        for (const ratio of RATIOS) {
            const item = htmlStringToElement<HTMLLIElement>(`<li><a class="dropdown-item">${ratio.width}:${ratio.height}</a></li>`)!;
            item.querySelector("a")?.addEventListener("click", (evt) => {
                evt.stopPropagation();
                const factor = Math.sqrt(ratio.width / ratio.height);
                const w = Math.round(size * factor / 8) * 8;
                const h = Math.round(size / factor / 8) * 8;
                this._widthInput.value = "" + w;
                this._heightInput.value = "" + h;
            });
            this._ratioSelect.append(item);
        }
    }

    //#endregion

    //#region Prompt set/get --------------------------------------------------

    public setPrompt(prompt?: PromptDTO): void {
        // -- Set all fields to passed prompt --
        this._positiveInput.value = prompt?.prompt ?? "";
        this._negativeInput.value = prompt?.negative_prompt ?? "";
        this._bufferSizeInput.value = "" + (prompt?.bufferSize ?? 10);
        this._widthInput.value = "" + (prompt?.width ?? 1024);
        this._heightInput.value = "" + (prompt?.height ?? 1024);
        this._modelsSelect.value = prompt?.model ?? "";
    }

    public getPrompt(): Omit<PromptDTO, "id" | "projectId" | "orderIndex" | "active"> {
        // -- Read values --
        const positivePrompt = this._positiveInput.value;
        const negativePrompt = this._negativeInput.value;
        const bufferSize = +this._bufferSizeInput.value;
        const width = +this._widthInput.value;
        const height = +this._heightInput.value;
        const model = this._modelsSelect.value;

        // -- Build object --
        return {
            prompt: positivePrompt,
            negative_prompt: negativePrompt ? negativePrompt : undefined,
            bufferSize,

            width,
            height,
            model
        };
    }

    //#endregion

}

customElements.define("editor-prompt", PromptEditor);

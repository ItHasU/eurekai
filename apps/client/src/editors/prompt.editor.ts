import { asNamed } from "@dagda/shared/entities/named.types";
import { PromptEntity, PromptId, Seed } from "@eurekai/shared/src/entities";
import { ModelInfo } from "@eurekai/shared/src/models.api";
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
const DEFAULT_SIZE_STEP = 8;

export class PromptEditor extends HTMLElement {

    protected _parentId: PromptId | null = null;
    protected readonly _positiveInput: HTMLInputElement;
    protected readonly _negativeInput: HTMLInputElement;
    protected readonly _negativeCol: HTMLDivElement;
    protected readonly _durationCol: HTMLDivElement;
    protected readonly _durationInput: HTMLInputElement;
    protected readonly _durationUnit: HTMLSpanElement;
    protected readonly _widthInput: HTMLInputElement;
    protected readonly _heightInput: HTMLInputElement;
    protected readonly _seedInput: HTMLInputElement;
    protected readonly _ratioSelect: HTMLUListElement;
    protected readonly _modelsSelect: HTMLSelectElement;
    protected readonly _modelsButton: HTMLButtonElement;

    constructor() {
        super();
        this.innerHTML = require("./prompt.editor.html").default;

        this._positiveInput = this.querySelector("#positiveInput") as HTMLInputElement;
        this._negativeInput = this.querySelector("#negativeInput") as HTMLInputElement;
        this._negativeCol = this.querySelector("#negativeCol") as HTMLDivElement;
        this._durationCol = this.querySelector("#durationCol") as HTMLDivElement;
        this._durationInput = this.querySelector("#durationInput") as HTMLInputElement;
        this._durationUnit = this.querySelector("#durationUnit") as HTMLSpanElement;
        this._widthInput = this.querySelector("#widthInput") as HTMLInputElement;
        this._heightInput = this.querySelector("#heightInput") as HTMLInputElement;
        this._seedInput = this.querySelector("#seedInput") as HTMLInputElement;
        this._ratioSelect = this.querySelector("#ratioSelect") as HTMLUListElement;
        this._modelsSelect = this.querySelector("#modelsSelect") as HTMLSelectElement;
        this._modelsButton = this.querySelector("#modelsButton") as HTMLButtonElement;

        this._fillRatios(DEFAULT_SIZE, DEFAULT_SIZE_STEP); // Use default size while model is not selected

        this._fillModelsSelect();
        this._modelsButton.addEventListener("click", this._fillModelsSelect.bind(this, true));
        this._modelsSelect.addEventListener("change", this._onModelsChange.bind(this));
    }

    //#region Models ----------------------------------------------------------

    protected _fillModelsSelect(forceRefresh: boolean = false): void {
        StaticDataProvider.getModels(forceRefresh).then((models) => {
            // Options are filled asynchronously, the selection may have been set before they exist
            const selectedUid = this._modelsSelect.value;
            this._modelsSelect.innerHTML = '';
            for (const model of models) {
                const option = `<option value="${model.uid}">${model.displayName}</option>`;
                this._modelsSelect.innerHTML += option;
            }
            if (selectedUid && models.some(model => model.uid === selectedUid)) {
                // Only restore an existing model, otherwise keep the first one selected by default
                this._modelsSelect.value = selectedUid;
            }
            return this._onModelsChange();
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
            this._fillRatios(DEFAULT_SIZE, DEFAULT_SIZE_STEP);
        } else {
            this._fillRatios(model.size, model.sizeStep ?? DEFAULT_SIZE_STEP);
        }
        this._applyModelOptions(model);
    }

    /** Show/hide the fields depending on the options declared by the model manifest */
    protected _applyModelOptions(model?: ModelInfo): void {
        // -- Negative prompt --
        // Hidden means the workflow has no $negative_prompt$, an empty one will be used
        this._negativeCol.classList.toggle("d-none", model?.negativePrompt === false);

        // -- Duration --
        const duration = model?.duration;
        this._durationCol.classList.toggle("d-none", duration == null);
        if (duration == null) {
            this._durationInput.value = "";
            this._durationUnit.textContent = "";
        } else {
            this._durationInput.min = "" + duration.min;
            this._durationInput.max = "" + duration.max;
            this._durationInput.step = "" + duration.step;
            this._durationUnit.textContent = duration.unit;
            // Reset to the default when empty or when the value of the previous model is out of bounds
            const value = +this._durationInput.value;
            if (this._durationInput.value === "" || isNaN(value) || value < duration.min || value > duration.max) {
                this._durationInput.value = "" + duration.default;
            }
        }
    }

    //#endregion

    //#region Ratios ----------------------------------------------------------

    protected _fillRatios(size: number, sizeStep: number): void {
        this._ratioSelect.innerHTML = '';
        for (const ratio of RATIOS) {
            const item = htmlStringToElement<HTMLLIElement>(`<li><a class="dropdown-item">${ratio.width}:${ratio.height}</a></li>`)!;
            item.querySelector("a")?.addEventListener("click", (evt) => {
                const factor = Math.sqrt(ratio.width / ratio.height);
                const w = Math.round(size * factor / sizeStep) * sizeStep;
                const h = Math.round(size / factor / sizeStep) * sizeStep;
                this._widthInput.value = "" + w;
                this._heightInput.value = "" + h;
            });
            this._ratioSelect.append(item);
        }
    }

    //#endregion

    //#region Prompt set/get --------------------------------------------------

    public setPrompt(prompt?: PromptEntity, seed?: Seed): void {
        // -- Set all fields to passed prompt --
        this._parentId = prompt?.id ?? null;
        this._positiveInput.value = prompt?.prompt ?? "";
        this._negativeInput.value = prompt?.negative_prompt ?? "";
        this._widthInput.value = "" + (prompt?.width ?? DEFAULT_SIZE);
        this._heightInput.value = "" + (prompt?.height ?? DEFAULT_SIZE);
        this._modelsSelect.value = prompt?.model ?? "";
        this._durationInput.value = prompt?.duration == null ? "" : "" + prompt.duration;
        this._seedInput.value = "" + (seed ?? "");

        // Setting the value of a select does not fire the change event, refresh the ratios
        // and the model options manually
        void this._onModelsChange();
    }

    public getPrompt(): Omit<PromptEntity, "id" | "projectId" | "orderIndex"> {
        // -- Read values --
        const positivePrompt = this._positiveInput.value;
        // The model may not support a negative prompt, in that case the field is hidden and ignored
        const negativePrompt = this._negativeCol.classList.contains("d-none") ? "" : this._negativeInput.value;
        const width = +this._widthInput.value;
        const height = +this._heightInput.value;
        const model = this._modelsSelect.value;
        const duration = this._durationCol.classList.contains("d-none") ? NaN : +this._durationInput.value;

        // -- Build object --
        return {
            parentId: this._parentId,
            prompt: asNamed(positivePrompt),
            negative_prompt: negativePrompt ? asNamed(negativePrompt) : asNamed(""),
            width: asNamed(width),
            height: asNamed(height),
            model: asNamed(model),
            duration: this._durationInput.value !== "" && !isNaN(duration) ? asNamed(duration) : undefined
        };
    }

    public getSeed(): Seed | undefined {
        const seedInteger: number = parseInt(this._seedInput.value);
        if (isNaN(seedInteger)) {
            return undefined;
        } else {
            return asNamed(seedInteger);
        }
    }

    //#endregion

}

customElements.define("editor-prompt", PromptEditor);

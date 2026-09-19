import { asNamed } from "@dagda/shared/entities/named.types";
import { PictureType, PromptEntity, PromptId, Seed, SourceImageEntity, SourceImageId } from "@eurekai/shared/src/entities";
import { ModelInfo } from "@eurekai/shared/src/models.api";
import { getPromptSources } from "@eurekai/shared/src/pictures.data";
import { htmlStringToElement } from "src/components/tools";
import { StaticDataProvider } from "src/tools/dataProvider";

type Ratio = { width: number, height: number, default?: boolean };
const RATIOS: Ratio[] = [
    { width: 21, height: 9 },
    { width: 16, height: 9 },
    { width: 4, height: 3 },
    { width: 1, height: 1, default: true},
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
    protected readonly _imageCol: HTMLDivElement;
    protected readonly _imageLabel: HTMLLabelElement;
    protected readonly _imageSelect: HTMLSelectElement;
    protected readonly _imageAddButton: HTMLButtonElement;
    protected readonly _imageError: HTMLDivElement;
    protected readonly _imageList: HTMLDivElement;
    protected _sourceImages: SourceImageEntity[] = [];
    /** Sources of the prompt being edited, in the order they will be handed over to the workflow */
    protected _selectedSourceIds: SourceImageId[] = [];
    /** Number of sources accepted by the selected model, 0 when it takes none */
    protected _maxSourceCount: number = 0;
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
        this._imageCol = this.querySelector("#imageCol") as HTMLDivElement;
        this._imageLabel = this.querySelector("#imageLabel") as HTMLLabelElement;
        this._imageSelect = this.querySelector("#imageSelect") as HTMLSelectElement;
        this._imageAddButton = this.querySelector("#imageAddButton") as HTMLButtonElement;
        this._imageError = this.querySelector("#imageError") as HTMLDivElement;
        this._imageList = this.querySelector("#imageList") as HTMLDivElement;
        this._widthInput = this.querySelector("#widthInput") as HTMLInputElement;
        this._heightInput = this.querySelector("#heightInput") as HTMLInputElement;
        this._seedInput = this.querySelector("#seedInput") as HTMLInputElement;
        this._ratioSelect = this.querySelector("#ratioSelect") as HTMLUListElement;
        this._modelsSelect = this.querySelector("#modelsSelect") as HTMLSelectElement;
        this._modelsButton = this.querySelector("#modelsButton") as HTMLButtonElement;

        this._fillRatios(DEFAULT_SIZE, DEFAULT_SIZE_STEP); // Use default size while model is not selected

        this._fillModelsSelect();
        this._modelsButton.addEventListener("click", this._fillModelsSelect.bind(this, true));
        this._modelsSelect.addEventListener("change", () => void this._onModelsChange(true));
        this._imageAddButton.addEventListener("click", () => this._addSelectedSource());
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
            // Only the initial fill picks the size of the model, refreshing the list must not
            // discard the resolution currently being edited
            return this._onModelsChange(!forceRefresh);
        }).catch(e => {
            console.error(e);
            this._modelsSelect.innerHTML = '<option value="">!Error!</option>';
        });
    }

    /**
     * Refresh the ratios and the fields depending on the selected model.
     * @param modelChanged The user picked another model : the resolution is reset to the default
     * ratio of the model and the sources it cannot take are dropped. False when the list of models
     * is refreshed or when an existing prompt is loaded, both of which must keep what is edited.
     */
    protected async _onModelsChange(modelChanged: boolean): Promise<void> {
        const uid = this._modelsSelect.value;
        const model = (await StaticDataProvider.getModels()).find(info => info.uid === uid);
        if (model == null) {
            // Model not found, use default value
            this._fillRatios(DEFAULT_SIZE, DEFAULT_SIZE_STEP, modelChanged);
        } else {
            this._fillRatios(model.size, model.sizeStep ?? DEFAULT_SIZE_STEP, modelChanged);
        }
        this._applyModelOptions(model, modelChanged);
    }

    /** Show/hide the fields depending on the options declared by the model manifest */
    protected _applyModelOptions(model?: ModelInfo, modelChanged: boolean = false): void {
        // -- Negative prompt --
        // Hidden means the workflow has no $negative_prompt$, an empty one will be used
        this._negativeCol.classList.toggle("d-none", model?.negativePrompt === false);

        // -- Sources --
        // Hidden means the workflow has no $image$. When shown, picking at least one source is
        // mandatory (enforced in getPrompt()) and the model caps how many can be picked.
        this._maxSourceCount = model?.imageCount ?? 0;
        this._imageCol.classList.toggle("d-none", this._maxSourceCount <= 0);
        this._imageLabel.textContent = this._maxSourceCount > 1 ? `Sources (up to ${this._maxSourceCount})` : "Source";
        if (modelChanged) {
            // Switching to a model taking less sources drops the extra ones rather than silently
            // generating with sources the workflow has no input for
            this._selectedSourceIds = this._selectedSourceIds.slice(0, Math.max(0, this._maxSourceCount));
        }
        this._refreshSources();

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

    //#region Sources ---------------------------------------------------------

    /** Set the list of sources the user can pick from (the sources of the current project) */
    public setSourceImages(images: SourceImageEntity[]): void {
        this._sourceImages = images;
        const selectedId = this._imageSelect.value;
        this._imageSelect.innerHTML = '<option value="">-- Select a source --</option>';
        for (const image of images) {
            const option = document.createElement("option");
            option.value = "" + image.id;
            option.textContent = image.name;
            this._imageSelect.append(option);
        }
        if (selectedId && images.some(image => "" + image.id === selectedId)) {
            this._imageSelect.value = selectedId;
        }
        // A source the user deleted in the meantime cannot stay in the list
        this._selectedSourceIds = this._selectedSourceIds.filter(sourceId => images.some(image => image.id === sourceId));
        this._refreshSources();
    }

    /** Append the source currently selected in the combo box at the end of the list */
    protected _addSelectedSource(): void {
        if (this._imageSelect.value === "" || this._selectedSourceIds.length >= this._maxSourceCount) {
            return;
        }
        this._selectedSourceIds.push(asNamed(+this._imageSelect.value));
        this._imageError.classList.add("d-none");
        this._refreshSources();
    }

    /** Move a source of the list one position up or down. The order is what the workflow gets. */
    protected _moveSource(index: number, offset: number): void {
        const target = index + offset;
        if (target < 0 || target >= this._selectedSourceIds.length) {
            return;
        }
        const [sourceId] = this._selectedSourceIds.splice(index, 1);
        this._selectedSourceIds.splice(target, 0, sourceId);
        this._refreshSources();
    }

    protected _removeSource(index: number): void {
        this._selectedSourceIds.splice(index, 1);
        this._refreshSources();
    }

    /** Rebuild the ordered list of the sources of the prompt */
    protected _refreshSources(): void {
        this._imageList.innerHTML = "";
        this._selectedSourceIds.forEach((sourceId, index) => {
            const source = this._sourceImages.find(image => image.id === sourceId);
            if (source == null) {
                // Not in the project anymore, it has been filtered out of _selectedSourceIds
                return;
            }
            this._imageList.append(this._buildSourceItem(source, index));
        });
        // The list is full, nothing more can be added
        this._imageAddButton.disabled = this._selectedSourceIds.length >= this._maxSourceCount;
    }

    protected _buildSourceItem(source: SourceImageEntity, index: number): HTMLElement {
        // htmlStringToElement() returns the template content's firstChild : the string must not
        // start with whitespace/a newline, otherwise firstChild is a text node, not the <div>.
        const item = htmlStringToElement<HTMLDivElement>(`<div class="list-group-item d-flex align-items-center gap-2 p-1">
                <span class="badge text-bg-secondary" ref="position"></span>
                <img class="rounded" style="width: 3rem; height: 3rem; object-fit: cover;" ref="thumbnail">
                <span class="text-truncate flex-grow-1" ref="name"></span>
                <div class="btn-group btn-group-sm">
                    <button type="button" class="btn btn-outline-secondary" ref="up" title="Move up"><i class="bi bi-arrow-up"></i></button>
                    <button type="button" class="btn btn-outline-secondary" ref="down" title="Move down"><i class="bi bi-arrow-down"></i></button>
                    <button type="button" class="btn btn-outline-danger" ref="remove" title="Remove"><i class="bi bi-x-lg"></i></button>
                </div>
            </div>`)!;

        item.querySelector("[ref='position']")!.textContent = "" + (index + 1);
        // A video has no still to display, the thumbnail route extracts a frame out of it
        const thumbnail = item.querySelector("[ref='thumbnail']") as HTMLImageElement;
        thumbnail.src = `/attachment/${source.attachmentId}/thumbnail`;
        thumbnail.alt = source.name;
        const name = item.querySelector("[ref='name']") as HTMLSpanElement;
        name.textContent = source.name;
        name.title = source.name;
        if (source.type === PictureType.VIDEO) {
            name.prepend(htmlStringToElement(`<i class="bi bi-camera-video me-1"></i>`)!);
        }

        const up = item.querySelector("[ref='up']") as HTMLButtonElement;
        up.disabled = index === 0;
        up.addEventListener("click", () => this._moveSource(index, -1));
        const down = item.querySelector("[ref='down']") as HTMLButtonElement;
        down.disabled = index === this._selectedSourceIds.length - 1;
        down.addEventListener("click", () => this._moveSource(index, +1));
        item.querySelector("[ref='remove']")!.addEventListener("click", () => this._removeSource(index));

        return item;
    }

    //#endregion

    //#region Ratios ----------------------------------------------------------

    protected _fillRatios(size: number, sizeStep: number, applyDefaultSize: boolean = true): void {
        this._ratioSelect.innerHTML = '';
        for (const ratio of RATIOS) {
            const item = htmlStringToElement<HTMLLIElement>(`<li><a class="dropdown-item">${ratio.width}:${ratio.height}</a></li>`)!;
            const cb = () => {
                const factor = Math.sqrt(ratio.width / ratio.height);
                const w = Math.round(size * factor / sizeStep) * sizeStep;
                const h = Math.round(size / factor / sizeStep) * sizeStep;
                this._widthInput.value = "" + w;
                this._heightInput.value = "" + h;
            };
            item.querySelector("a")?.addEventListener("click", cb);
            this._ratioSelect.append(item);

            if (applyDefaultSize && ratio.default === true) {
                cb();
            }
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
        this._selectedSourceIds = prompt == null ? [] : getPromptSources(StaticDataProvider.entitiesHandler, prompt.id).map(source => source.id);
        this._imageSelect.value = "";
        this._imageError.classList.add("d-none");
        this._seedInput.value = "" + (seed ?? "");

        // Setting the value of a select does not fire the change event, refresh the ratios
        // and the model options manually, keeping the resolution of the prompt.
        // The sources are refreshed by _applyModelOptions(), which is the one knowing how many
        // of them the model accepts, but the list is displayed right away rather than one tick later
        this._refreshSources();
        void this._onModelsChange(false);
    }

    /**
     * @returns The prompt built from the form, or null if it is invalid (a required source
     * is missing). On null, the offending field is already marked invalid for the user to see.
     * The sources of the prompt are returned separately, @see getSourceIds().
     */
    public getPrompt(): Omit<PromptEntity, "id" | "projectId" | "orderIndex"> | null {
        // -- Read values --
        const positivePrompt = this._positiveInput.value;
        // The model may not support a negative prompt, in that case the field is hidden and ignored
        const negativePrompt = this._negativeCol.classList.contains("d-none") ? "" : this._negativeInput.value;
        const width = +this._widthInput.value;
        const height = +this._heightInput.value;
        const model = this._modelsSelect.value;
        const duration = this._durationCol.classList.contains("d-none") ? NaN : +this._durationInput.value;

        // -- Sources : at least one is mandatory when the model requires them --
        if (!this._imageCol.classList.contains("d-none") && this._selectedSourceIds.length === 0) {
            this._imageError.classList.remove("d-none");
            return null;
        }

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

    /** @returns The sources of the prompt, in the order they must be handed over to the workflow */
    public getSourceIds(): SourceImageId[] {
        return this._imageCol.classList.contains("d-none") ? [] : [...this._selectedSourceIds];
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

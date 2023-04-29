import { ComputationStatus, PictureDTO, PromptDTO } from "@eurekai/shared/src/types";
import { AbstractDTOElement } from "./abstract.dto.element";

export class PictureElement extends AbstractDTOElement<PictureDTO> {

    constructor(data: PictureDTO, public prompt: PromptDTO | undefined, protected _options: {
        accept: () => void,
        reject: () => void
    }) {
        super(data, require("./picture.element.html").default);
        this.classList.add("col-md-4", "col-lg-3");
    }

    public get isWaitingEvaluation(): boolean {
        return this.data.computed >= ComputationStatus.DONE;
    }

    public override refresh(): void {
        super.refresh();
        this._bindClick("accept", this._options.accept);
        this._bindClick("reject", this._options.reject);
    }
}

customElements.define("custom-picture", PictureElement);
import { ComputationStatus, PictureDTO, PromptDTO } from "@eurekai/shared/src/types";
import { AbstractDTOElement } from "./abstract.dto.element";

export class PromptElement extends AbstractDTOElement<PromptDTO> {

    public readonly rejectedCount: number;
    public readonly pendingCount: number;
    public readonly acceptedCount: number;
    public readonly rejectedPercent: number;
    public readonly pendingPercent: number;
    public readonly acceptedPercent: number;

    constructor(data: PromptDTO, protected _options: {
        pictures: PictureDTO[],
        start: () => void,
        stop: () => void,
        delete: () => void,
        move: () => void,
        clone?: () => void
    }) {
        super(data, require("./prompt.element.html").default);
        this.rejectedCount = _options.pictures.filter(p => p.status === ComputationStatus.REJECTED && p.promptId === this.data.id).length;
        this.pendingCount = _options.pictures.filter(p => p.status === ComputationStatus.DONE && p.promptId === this.data.id).length;
        this.acceptedCount = _options.pictures.filter(p => p.status === ComputationStatus.ACCEPTED && p.promptId === this.data.id).length;
        const total = this.rejectedCount + this.pendingCount + this.acceptedCount;
        this.rejectedPercent = this.rejectedCount / total * 100;
        this.pendingPercent = this.pendingCount / total * 100;
        this.acceptedPercent = this.acceptedCount / total * 100;
    }

    public get hasCloneMethod(): boolean {
        return this._options.clone != null;
    }

    public override refresh(): void {
        super.refresh();
        this._bindClick("accept", this._options.start);
        this._bindClick("reject", this._options.stop);
        if (this._options.clone) {
            this._bindClick("clone", this._options.clone);
        }
        this._bindClick("delete", this._options.delete);
        this._bindClick("move", this._options.move);
    }

}

customElements.define("custom-prompt", PromptElement);
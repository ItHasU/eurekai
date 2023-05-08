import { PromptDTO } from "@eurekai/shared/src/types";
import { AbstractDTOElement } from "./abstract.dto.element";

export class PromptElement extends AbstractDTOElement<PromptDTO> {

    constructor(data: PromptDTO, protected _options: {
        start: () => void,
        stop: () => void,
        clone?: () => void
    }) {
        super(data, require("./prompt.element.html").default);
    }

    public override refresh(): void {
        super.refresh();
        this._bindClick("accept", this._options.start);
        this._bindClick("reject", this._options.stop);
        if (this._options.clone) {
            this._bindClick("clone", this._options.clone);
        }
    }

}

customElements.define("custom-prompt", PromptElement);
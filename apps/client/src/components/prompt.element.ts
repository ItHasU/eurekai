import { PromptDTO } from "@eurekai/shared/src/types";
import { AbstractDTOElement } from "./abstract.dto.element";

export class PromptElement extends AbstractDTOElement<PromptDTO> {
    
    constructor(data: PromptDTO, protected _options: {
        accept: () => void,
        reject: () => void,
        clone: () => void
    }) {
        super(data, require("./prompt.element.html").default);
        this.classList.add("col-md-4");
    }

    public override refresh(): void {
        super.refresh();
        this._bindClick("accept", this._options.accept);
        this._bindClick("reject", this._options.reject);
        this._bindClick("clone", this._options.clone);
    }

}

customElements.define("custom-prompt", PromptElement);
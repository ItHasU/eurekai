import { PromptDTO } from "@eurekai/shared/src/types";
import { AbstractDTOElement } from "./abstract.dto.element";

export class PromptElement extends AbstractDTOElement<PromptDTO> {
    
    constructor(data: PromptDTO) {
        super(data, require("./prompt.element.html").default);
        this.classList.add("col-md-4");
    }

}

customElements.define("custom-prompt", PromptElement);
import { PictureDTO, PromptDTO } from "@eurekai/shared/src/types";
import { AbstractDTOElement } from "./abstract.dto.element";

export class PictureElement extends AbstractDTOElement<PictureDTO> {
    
    constructor(data: PictureDTO, public prompt?: PromptDTO) {
        super(data, require("./picture.element.html").default);
        this.classList.add("col-md-4");
        this._refresh();
    }

}

customElements.define("custom-picture", PictureElement);
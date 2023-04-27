import { PictureDTO } from "@eurekai/shared/src/types";
import { AbstractDTOElement } from "./abstract.dto.element";

export class PictureElement extends AbstractDTOElement<PictureDTO> {
    
    constructor(data: PictureDTO) {
        super(data, require("./picture.element.html").default);
        this.classList.add("col-md-4");
    }

}

customElements.define("custom-picture", PictureElement);
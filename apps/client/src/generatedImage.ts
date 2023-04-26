import { PictureDTO } from "@eurekai/shared/src/types";
import { AbstractDTOElement } from "./components/abstract.dto.element";

export class GeneratedImageElement extends AbstractDTOElement<PictureDTO> {

    constructor(data: PictureDTO) {
        super(data, require("./generatedImage.html").default);
        this.classList.add("col-md-4");
    }
    
}

customElements.define("generated-img", GeneratedImageElement);
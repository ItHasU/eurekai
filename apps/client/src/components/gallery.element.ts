import { PictureDTO } from "@eurekai/shared/src/types";
import { AbstractDTOElement } from "./abstract.dto.element";

export class GalleryElement extends AbstractDTOElement<PictureDTO> {

    constructor(data: PictureDTO) {
        super(data, require("./gallery.element.html").default);
    }

    public override refresh(): void {
        super.refresh();
        const img = this.querySelector("img") as HTMLImageElement;
        img.src = `/api/attachment/${this.data.highresAttachmentId}`;
    }

}

customElements.define("custom-gallery", GalleryElement);
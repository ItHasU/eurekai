import { PictureDTO } from "@eurekai/shared/src/types";
import { AbstractDTOElement } from "./abstract.dto.element";

export class GalleryElement extends AbstractDTOElement<PictureDTO> {

    constructor(data: PictureDTO, protected _options: {
        delete: () => void;
        featured: () => void;
    }) {
        super(data, require("./gallery.element.html").default);
    }

    public override refresh(): void {
        super.refresh();
        this._bindClick("delete", this._options.delete);
        this._bindClick("featured", this._options.featured);

        if (this.data.attachmentId) {
            const img = this.querySelector("img.original") as HTMLImageElement;
            img.src = `/api/attachment/${this.data.attachmentId}`;
        }
        if (this.data.highresAttachmentId) {
            const img = this.querySelector("img.highres") as HTMLImageElement;
            img.src = `/api/attachment/${this.data.highresAttachmentId}`;
        }
    }

}

customElements.define("custom-gallery", GalleryElement);
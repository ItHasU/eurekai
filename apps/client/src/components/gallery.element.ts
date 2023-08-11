import { PictureDTO, PromptDTO } from "@eurekai/shared/src/types";
import { AbstractDTOElement } from "./abstract.dto.element";

enum DisplayMode {
    HIGHRES = "highres",
    NORMAL = "normal",
    BOTH = "both"
}

export class GalleryElement extends AbstractDTOElement<PictureDTO> {

    protected _mode: DisplayMode = DisplayMode.HIGHRES;

    constructor(data: PictureDTO, public readonly _options: {
        prompt?: PromptDTO;
        isLockable: boolean;
        delete: () => void;
        featured: () => void;
    }) {
        super(data, require("./gallery.element.html").default);
    }

    public override refresh(): void {
        super.refresh();
        this._bindClick("delete", this._options.delete);
        this._bindClick("featured", this._options.featured);
        this._bindDisplayMode(DisplayMode.HIGHRES);
        this._bindDisplayMode(DisplayMode.NORMAL);
        this._bindDisplayMode(DisplayMode.BOTH);
        this._refresh_mode();

        if (this.data.attachmentId) {
            const img = this.querySelector("img.original") as HTMLImageElement;
            img.src = `/api/attachment/${this.data.attachmentId}`;
        }
        if (this.data.highresAttachmentId) {
            const img = this.querySelector("img.highres") as HTMLImageElement;
            img.src = `/api/attachment/${this.data.highresAttachmentId}`;
        }
    }

    protected _bindDisplayMode(mode: DisplayMode): void {
        this._bindClick(mode, () => {
            this._mode = mode;
            this._refresh_mode();
        });
    }

    protected _refresh_mode(): void {
        const lrImage = this.querySelector(".original");
        const hrImage = this.querySelector(".highres");
        switch (this._mode) {
            case DisplayMode.HIGHRES:
                hrImage?.classList.toggle("d-none", false);
                lrImage?.classList.toggle("d-none", true);
                lrImage?.classList.toggle("overlay", false);
                this._getElementByRef(DisplayMode.HIGHRES)?.classList.toggle("active", true);
                this._getElementByRef(DisplayMode.NORMAL)?.classList.toggle("active", false);
                this._getElementByRef(DisplayMode.BOTH)?.classList.toggle("active", false);
                break;
            case DisplayMode.NORMAL:
                hrImage?.classList.toggle("d-none", true);
                lrImage?.classList.toggle("d-none", false);
                lrImage?.classList.toggle("overlay", false);
                this._getElementByRef(DisplayMode.HIGHRES)?.classList.toggle("active", false);
                this._getElementByRef(DisplayMode.NORMAL)?.classList.toggle("active", true);
                this._getElementByRef(DisplayMode.BOTH)?.classList.toggle("active", false);
                break;
            case DisplayMode.BOTH:
                hrImage?.classList.toggle("d-none", false);
                lrImage?.classList.toggle("d-none", false);
                lrImage?.classList.toggle("overlay", true);
                this._getElementByRef(DisplayMode.HIGHRES)?.classList.toggle("active", false);
                this._getElementByRef(DisplayMode.NORMAL)?.classList.toggle("active", false);
                this._getElementByRef(DisplayMode.BOTH)?.classList.toggle("active", true);
                break;
        }
    }
}

customElements.define("custom-gallery", GalleryElement);
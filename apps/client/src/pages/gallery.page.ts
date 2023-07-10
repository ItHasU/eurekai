import { ComputationStatus, HighresStatus, PictureDTO, ProjectDTO, PromptDTO } from "@eurekai/shared/src/types";
import { AbstractPageElement } from "./abstract.page.element";
import { PictureElement } from "src/components/picture.element";
import { zipPictures } from "@eurekai/shared/src/utils";
import { PromptElement } from "src/components/prompt.element";
import { DataCache } from "@eurekai/shared/src/cache";
import { GalleryElement } from "src/components/gallery.element";

/** Display projects and fire an event on project change */
export class GalleryPage extends AbstractPageElement {

    protected readonly _picturesDiv: HTMLDivElement;

    constructor(cache: DataCache) {
        super(require("./gallery.page.html").default, cache);

        // -- Get components --
        this._picturesDiv = this.querySelector("#picturesDiv") as HTMLDivElement;
    }

    /** @inheritdoc */
    protected override async _refresh(): Promise<void> {
        const picturesRaw = await this._cache.getPictures();
        const pictures = picturesRaw.filter(p => p.highres === HighresStatus.DONE && p.highresAttachmentId != null);
        pictures.sort((a, b) => -((a.highresAttachmentId ?? 0) - (b.highresAttachmentId ?? 0)));

        // -- Clear --
        this._picturesDiv.innerHTML = "";

        // -- Fill the pictures --
        const picturesDiv = this.querySelector("#picturesDiv") as HTMLDivElement;
        for (const picture of pictures) {
            // -- Add the picture --
            const item = new GalleryElement(picture, {
                delete: async () => {
                    await this._cache.withData(async (data) => {
                        data.deletePictureHighres(picture.id);
                    });
                    // Remove item from the DOM
                    item.remove();
                },
                featured: async () => {
                    await this._cache.withData(async (data) => {
                        await data.setProjectFeaturedImage(picture.projectId, picture.attachmentId ?? picture.highresAttachmentId ?? null);
                    });
                    await this.refresh();
                }
            });
            item.classList.add("col-sm-12", "col-md-6");
            picturesDiv.appendChild(item);
            item.refresh();
        }
        picturesDiv.scrollTo(0, 0);
    }

}

customElements.define("gallery-page", GalleryPage);
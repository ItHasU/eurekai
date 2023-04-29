import { PicturesWrapper } from "@eurekai/shared/src/pictures.wrapper";
import { PromptsWrapper } from "@eurekai/shared/src/prompts.wrapper";
import PouchDB from "pouchdb";
import { PictureElement } from "src/components/picture.element";

export class ClientPictureManager {
    protected readonly _prompts: PromptsWrapper;
    protected readonly _pictures: PicturesWrapper;

    // -- Buttons --
    protected _cleanButton: HTMLButtonElement;

    // -- Images divs --
    protected _imagesDiv: HTMLDivElement;
    protected _imagesCache: { [_id: string]: PictureElement } = {};

    constructor() {
        this._prompts = new PromptsWrapper(PouchDB);
        this._pictures = new PicturesWrapper(PouchDB);
        this._pictures.addChangeListener(this._refresh.bind(this));
        this._pictures.setSync(document.location.href + "db/pictures/");

        // -- Get components --
        this._cleanButton = document.getElementById("cleanButton") as HTMLButtonElement;
        this._imagesDiv = document.getElementById("imagesDiv") as HTMLDivElement;

        // -- Bind callbacks --
        this._cleanButton.addEventListener("click", this._onCleanClick.bind(this));

        this._refresh();
    }

    /** Refresh images */
    protected async _refresh(): Promise<void> {
        try {
            // -- Get images --
            const images = await this._pictures.getAll({ attachments: true });

            // -- Clear --
            this._imagesDiv.innerHTML = "";
            // -- Render --
            for (const image of images) {
                const existing: PictureElement | undefined = this._imagesCache[image._id];
                if (existing == null) {
                    // Not existing yet
                    const prompt = await this._prompts.getById(image.promptId);
                    const element = new PictureElement(image, prompt);
                    this._imagesDiv.append(element);
                } else {
                    // Existing
                    existing.setData(image); // Maybe image has been updated
                    this._imagesDiv.append(existing);
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    protected async _onCleanClick(): Promise<void> {
        console.log("Cleaning");
        try {
            await this._pictures.clean();
            this._refresh();
        } catch (e) {
            console.error(e);
        }
    }

}
import { PicturesWrapper } from "@eurekai/shared/src/pictures.wrapper";
import { PromptsWrapper } from "@eurekai/shared/src/prompts.wrapper";
import { ComputationStatus, PictureDTO, PromptDTO } from "@eurekai/shared/src/types";
import PouchDB from "pouchdb";
import { PictureElement } from "src/components/picture.element";

export class ClientPictureManager {
    protected readonly _prompts: PromptsWrapper;
    protected readonly _pictures: PicturesWrapper;

    // -- Components --
    protected _cleanButton: HTMLButtonElement;
    protected _picturesFilterSelect: HTMLSelectElement;

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
        this._picturesFilterSelect = document.getElementById("picturesFilterSelect") as HTMLSelectElement;

        // -- Bind callbacks --
        this._cleanButton.addEventListener("click", this._onCleanClick.bind(this));
        this._picturesFilterSelect.addEventListener("change", this._refresh.bind(this));

        this._refresh();
    }

    /** Refresh images */
    protected async _refresh(): Promise<void> {
        try {
            // -- Get images --
            const prompts = await this._prompts.getAll();
            const images = await this._pictures.getAll({ attachments: true });

            const promptsMap: { [id: string]: PromptDTO } = {};
            for (const prompt of prompts) {
                promptsMap[prompt._id] = prompt;
            }

            images.sort((p1, p2) => {
                let res = 0;

                if (res === 0) {
                    const prompt1 = promptsMap[p1.promptId];
                    const prompt2 = promptsMap[p2.promptId];
                    if (prompt1 && prompt2) {
                        res = prompt1.index - prompt2.index;
                    }
                }

                if (res === 0) {
                    res = p1.computed - p2.computed;
                }

                if (res === 0) {
                    res = p1._id.localeCompare(p2._id);
                }

                return res;
            });

            // -- Get the filter --
            let filter: (picture: PictureDTO) => boolean = function () { return true };
            const filterIndex = this._picturesFilterSelect.value;
            switch (filterIndex) {
                case "done":
                    filter = function (picture) { return picture.computed === ComputationStatus.DONE; }
                    break;
                    case "accept":
                    filter = function (picture) { return picture.computed === ComputationStatus.ACCEPTED; }
                    break;
                    case "reject":
                    filter = function (picture) { return picture.computed === ComputationStatus.REJECTED; }
                    break;
                default:
                    console.error(`Invalid value : ${filterIndex}`)
            }

            // -- Clear --
            this._imagesDiv.innerHTML = "";
            // -- Render --
            for (const image of images) {
                const existing: PictureElement | undefined = this._imagesCache[image._id];

                if (!filter(image)) {
                    continue;
                }

                if (existing == null) {
                    // Not existing yet
                    const prompt = promptsMap[image.promptId];
                    const element = new PictureElement(image, prompt, {
                        accept: async () => {
                            await this._pictures.setStatus(image._id, ComputationStatus.ACCEPTED);
                            this._refresh();
                        },
                        reject: async () => {
                            await this._pictures.setStatus(image._id, ComputationStatus.REJECTED);
                            this._refresh();
                        }
                    });
                    this._imagesDiv.append(element);
                    element.refresh();
                } else {
                    // Existing
                    existing.setData(image); // Maybe image has been updated
                    this._imagesDiv.append(existing);
                    existing.refresh();
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
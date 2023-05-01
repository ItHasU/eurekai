import { PicturesWrapper } from "@eurekai/shared/src/pictures.wrapper";
import { PromptsWrapper } from "@eurekai/shared/src/prompts.wrapper";
import { ComputationStatus, PictureDTO, PromptDTO } from "@eurekai/shared/src/types";
import { PictureElement } from "src/components/picture.element";
import { zipPictures } from "@eurekai/shared/src/utils";

export class ClientPictureManager {

    // -- Components --
    protected _cleanButton: HTMLButtonElement;
    protected _picturesFilterSelect: HTMLSelectElement;

    // -- Images divs --
    protected _imagesDiv: HTMLDivElement;
    protected _imagesCache: { [_id: string]: PictureElement } = {};

    constructor(
        protected readonly _prompts: PromptsWrapper,
        protected readonly _pictures: PicturesWrapper
    ) {
        this._prompts.addChangeListener(this._refresh.bind(this));
        this._pictures.addChangeListener(this._refresh.bind(this));

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
                    res = p1.createdAt - p2.createdAt;
                }

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
            let filter: (picture: PictureDTO) => boolean = this._getFilter();

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
                        },
                        start: async () => {
                            await this._prompts.toggle(prompt, true);
                            this._refresh();
                        },
                        stop: async () => {
                            await this._prompts.toggle(prompt, false);
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

    protected _getFilter(): (picture: PictureDTO) => boolean {
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
        return filter;
    }

    protected async _onCleanClick(): Promise<void> {
        try {
            const zip = await zipPictures({
                prompts: this._prompts,
                pictures: this._pictures,
                filter: this._getFilter()
            });
            const blob = await zip.generateAsync({ type: "blob" });
            const a: HTMLAnchorElement = document.createElement("a");
            const url = window.URL.createObjectURL(blob);
            a.href = url;
            a.download = "pictures.zip";
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            console.error(e);
        }
        // try {
        //     const filter = this._getFilter();
        //     await this._pictures.clean(filter);
        //     this._refresh();
        // } catch (e) {
        //     console.error(e);
        // }
    }

}
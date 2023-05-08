import { ComputationStatus, PictureDTO, PromptDTO } from "@eurekai/shared/src/types";
import { AbstractDTOElement } from "./abstract.dto.element";

export class PictureElement extends AbstractDTOElement<PictureDTO> {

    constructor(data: PictureDTO, public prompt: PromptDTO | undefined, protected _options: {
        accept: () => void,
        reject: () => void,
        start: () => void,
        stop: () => void,
        fetch: (attachmentId: number) => Promise<string>
    }) {
        super(data, require("./picture.element.html").default);
    }

    public get isWaitingEvaluation(): boolean {
        return this.data.computed >= ComputationStatus.DONE;
    }

    public get isAccepted(): boolean {
        return this.data.computed == ComputationStatus.ACCEPTED;
    }

    public get isRejected(): boolean {
        return this.data.computed >= ComputationStatus.REJECTED;
    }

    public override refresh(): void {
        super.refresh();
        this._bindClick("accept", this._options.accept);
        this._bindClick("reject", this._options.reject);
        this._bindClick("start", this._options.start);
        this._bindClick("stop", this._options.stop);

        // Get element with class "image"
        const img: HTMLImageElement = this.querySelector(".card-img-top") as HTMLImageElement;
        // Use an observer to detect when the image is displayed on screen
        const observer = new IntersectionObserver(async(entries) => {
            if (entries.length > 0 && entries[0].target === img && entries[0].isIntersecting) {
                // Load the image
                if (this.data.attachmentId != null) {
                    img.src = `/api/attachment/${this.data.attachmentId}`;
                }
            } else {
                // Unload the image
                img.removeAttribute("src");
            }
        });
        observer.observe(img);
    }
}

customElements.define("custom-picture", PictureElement);
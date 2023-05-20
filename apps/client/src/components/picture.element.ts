import { ComputationStatus, PictureDTO, PromptDTO } from "@eurekai/shared/src/types";
import { AbstractDTOElement } from "./abstract.dto.element";
import Hammer from "hammerjs";

export class PictureElement extends AbstractDTOElement<PictureDTO> {

    constructor(data: PictureDTO, public prompt: PromptDTO | undefined, public isPreferredSeed: boolean, protected _options: {
        accept: () => void,
        reject: () => void,
        start: () => void,
        stop: () => void,
        toggleSeed: () => void,
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
        this._bindClick("seed", this._options.toggleSeed);

        // Get element with class "image"
        const img: HTMLImageElement = this.querySelector(".card-img-top") as HTMLImageElement;
        // Use an observer to detect when the image is displayed on screen
        const observer = new IntersectionObserver(async (entries) => {
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

        // Prevent scrolling when touching at the center of the image
        img.addEventListener("touchstart", (ev) => {
            // Get the position of the touch point
            const touch = ev.touches[0];
            const x = touch.clientX;
            // Do a ratio with the image width
            const ratio = x / img.clientWidth;
            // If the touch is in the center of the image
            if (ratio > 0.33 && ratio < 0.66) {
                // Prevent scrolling
                ev.preventDefault();
            }
        });

        // -- Bind swipe on image events --
        // create a simple instance
        // by default, it only adds horizontal recognizers
        var mc = new Hammer(img);

        // listen to events...
        mc.on("swipeleft swiperight", (ev) => {
            if (!ev.isFinal) {
                // Ensure a minimal swipe distance
                return;
            }

            if (ev.type == "swipeleft") {
                ev.srcEvent.stopPropagation();
                this._options.accept();
            } else if (ev.type == "swiperight") {
                ev.srcEvent.stopPropagation();
                this._options.reject();
            }
        });
    }
}

customElements.define("custom-picture", PictureElement);
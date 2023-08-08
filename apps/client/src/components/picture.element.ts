import { ComputationStatus, HighresStatus, PictureDTO, PromptDTO } from "@eurekai/shared/src/types";
import { AbstractDTOElement } from "./abstract.dto.element";

enum SwipeMode {
    NONE,
    ACCEPT_STARTED,
    ACCEPT_DONE,
    REJECT_STARTED,
    REJECT_DONE,
    HIGHRES_DONE
}

const colors: Record<SwipeMode, string> = {
    [SwipeMode.NONE]: "",
    [SwipeMode.ACCEPT_STARTED]: "rgba(0, 255, 0, 0.15)",
    [SwipeMode.ACCEPT_DONE]: "rgba(0, 255, 0, 0.25)",
    [SwipeMode.REJECT_STARTED]: "rgba(255, 0, 0, 0.15)",
    [SwipeMode.REJECT_DONE]: "rgba(255, 0, 0, 0.25)",
    [SwipeMode.HIGHRES_DONE]: "rgba(0, 0, 255, 0.25)"
};

const ACTION_SWIPE_MARGIN = 0.2;

export class PictureElement extends AbstractDTOElement<PictureDTO> {

    protected _swipeMode: SwipeMode = SwipeMode.NONE;

    constructor(data: PictureDTO, public readonly _options: {
        prompt: PromptDTO | undefined,
        /** Pass true so image can be blurred if app is locked */
        isLockable: boolean,
        isPreferredSeed: boolean,
        accept: () => void,
        reject: () => void,
        start: () => void,
        stop: () => void,
        toggleSeed: () => void,
        toggleHighres: () => void,
        setAsFeatured: () => void,
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
        this._bindClick("highres", this._options.toggleHighres);
        this._bindClick("featured", this._options.setAsFeatured);

        // Get element with class "image"
        const img: HTMLImageElement = this.querySelector(".card-img-top > img") as HTMLImageElement;
        // Use an observer to detect when the image is displayed on screen
        const observer = new IntersectionObserver(async (entries) => {
            if (entries.length > 0 && entries[0].target === img.parentElement && entries[0].isIntersecting) {
                // Load the image
                if (this.data.attachmentId != null) {
                    img.src = `/api/attachment/${this.data.attachmentId}`;
                }
            } else {
                // Unload the image
                img.removeAttribute("src");
            }
        });
        observer.observe(img.parentElement!); // Here we know that we have a parent element for sure due to the CSS selector

        // -- Handle swipe --
        // Handle accept / reject swipe moves
        // Prevent scrolling when touching outside the center of the image
        const feedbackDiv: HTMLDivElement = this.querySelector(".card-img-top > div") as HTMLDivElement;
        img.addEventListener("touchstart", (ev) => {
            if (ev.touches.length != 1) {
                // Don't care about multi-touch
                this._swipeMode = SwipeMode.NONE;
                return;
            }

            // Get the position of the touch point
            const touch = ev.touches[0];
            const x = touch.clientX;
            // Do a ratio with the image width
            const ratio = x / img.clientWidth;
            // If the touch is in the center of the image
            if (ratio < ACTION_SWIPE_MARGIN) {
                // Prevent scrolling, show reject icon
                this._swipeMode = SwipeMode.REJECT_STARTED;
                ev.preventDefault();
            } else if (ratio > (1 - ACTION_SWIPE_MARGIN)) {
                // Prevent scrolling, show accept icon
                this._swipeMode = SwipeMode.ACCEPT_STARTED;
                ev.preventDefault();
            } else {
                // At the center, leave the default behavior
                this._swipeMode = SwipeMode.NONE;
            }
            feedbackDiv.style.background = colors[this._swipeMode];
        });
        img.addEventListener("touchmove", (ev) => {
            if (ev.touches.length < 1) {
                // Don't care about multi-touch
                this._swipeMode = SwipeMode.NONE;
                feedbackDiv.style.background = colors[this._swipeMode];
                return;
            }

            if (this._swipeMode != SwipeMode.NONE) {
                // Prevent default behavior
                ev.preventDefault();
            }

            // Get the position of the touch point
            const touch = ev.touches[0];
            const x = touch.clientX;
            // Do a ratio with the image width
            const ratio = x / img.clientWidth;
            // If the touch is in the center of the image
            if (this._swipeMode == SwipeMode.REJECT_STARTED && ratio > ACTION_SWIPE_MARGIN) {
                // We crossed the accept limit, reject the image
                this._swipeMode = SwipeMode.REJECT_DONE;
            } else if (this._swipeMode == SwipeMode.REJECT_DONE && ratio < ACTION_SWIPE_MARGIN) {
                // Cancel the reject mode
                this._swipeMode = SwipeMode.REJECT_STARTED;
            } else if (this._swipeMode == SwipeMode.ACCEPT_STARTED && ratio < (1 - ACTION_SWIPE_MARGIN)) {
                // We crossed the reject limit, accept the image
                this._swipeMode = SwipeMode.ACCEPT_DONE;
            } else if (this._swipeMode == SwipeMode.ACCEPT_DONE && ratio > (1 - ACTION_SWIPE_MARGIN)) {
                // Cancel the accept mode
                this._swipeMode = SwipeMode.ACCEPT_STARTED;
            } else if (this._swipeMode == SwipeMode.ACCEPT_DONE && ratio < ACTION_SWIPE_MARGIN) {
                // Cancel the accept mode
                this._swipeMode = SwipeMode.HIGHRES_DONE;
            } else if (this._swipeMode == SwipeMode.HIGHRES_DONE && ratio > ACTION_SWIPE_MARGIN) {
                // Cancel the accept mode
                this._swipeMode = SwipeMode.ACCEPT_DONE;
            } else {
                // Nothing to do
            }

            feedbackDiv.style.background = colors[this._swipeMode];
        });
        img.addEventListener("touchend", (ev) => {
            if (this._swipeMode == SwipeMode.ACCEPT_DONE) {
                // We crossed the accept limit, accept the image
                this._options.accept();
            } else if (this._swipeMode == SwipeMode.REJECT_DONE) {
                // We crossed the reject limit, reject the image
                this._options.reject();
            } else if (this._swipeMode == SwipeMode.HIGHRES_DONE) {
                // We crossed the reject limit, reject the image
                this._options.accept();
                this._options.toggleHighres();
            } else {
                // Nothing to do
            }
            // Reset the swipe mode
            this._swipeMode = SwipeMode.NONE;
            feedbackDiv.style.background = colors[this._swipeMode];
        });

        // -- Handle highres --
        const highresButton: HTMLButtonElement = this.querySelector("*[ref='highres']") as HTMLButtonElement;
        const highresIcon: HTMLSpanElement = highresButton.querySelector("i") as HTMLElement;
        highresIcon.classList.remove("bi-star", "bi-star-fill", "bi-star-half");
        switch (this.data.highres) {
            case HighresStatus.NONE:
                highresIcon.classList.add("bi-star");
                highresButton.disabled = false;
                break;
            case HighresStatus.PENDING:
                highresIcon.classList.add("bi-star-half");
                highresButton.disabled = false;
                break;
            case HighresStatus.COMPUTING:
                highresIcon.classList.add("bi-star-half");
                highresButton.disabled = true;
                break;
            case HighresStatus.DONE:
                highresIcon.classList.add("bi-star-fill");
                highresButton.disabled = true;
                break;
            case HighresStatus.ERROR:
                highresIcon.classList.add("bi-star", "text-danger");
                highresButton.disabled = false;
                break;
            case HighresStatus.DELETED:
                highresIcon.classList.add("bi-star-fill", "text-muted");
                highresButton.disabled = false;
                break;
        }
    }
}

customElements.define("custom-picture", PictureElement);
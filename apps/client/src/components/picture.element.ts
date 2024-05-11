import { asNamed } from "@dagda/shared/entities/named.types";
import { ComputationStatus, PictureEntity, PromptEntity, Score } from "@eurekai/shared/src/entities";
import { AbstractDTOElement } from "./abstract.dto.element";

enum SwipeMode {
    NONE,
    ACCEPT_STARTED,
    ACCEPT_DONE,
    REJECT_STARTED,
    REJECT_DONE
}

const colors: Record<SwipeMode, string> = {
    [SwipeMode.NONE]: "",
    [SwipeMode.ACCEPT_STARTED]: "rgba(0, 255, 0, 0.15)",
    [SwipeMode.ACCEPT_DONE]: "rgba(0, 255, 0, 0.25)",
    [SwipeMode.REJECT_STARTED]: "rgba(255, 0, 0, 0.15)",
    [SwipeMode.REJECT_DONE]: "rgba(255, 0, 0, 0.25)"
};

const ACTION_SWIPE_MARGIN = 0.2;

export class PictureElement extends AbstractDTOElement<PictureEntity> {

    protected _swipeMode: SwipeMode = SwipeMode.NONE;

    constructor(data: PictureEntity, public readonly _options: {
        prompt: PromptEntity | undefined,
        /** Pass true so image can be blurred if app is locked */
        isLockable: boolean,
        isPreferredSeed: boolean,
        accept: () => void,
        reject: () => void,
        toggleSeed: () => void,
        setAsFeatured: () => void,
        setScore: (score: Score) => void
    }) {
        super(data, require("./picture.element.html").default);
        // [Disabled] Preload the image, it will only be displayed when element is visible
        // new Image().src = `/attachment/${this.data.attachmentId}`;
    }

    public get isWaitingEvaluation(): boolean {
        return this.data.status >= ComputationStatus.DONE;
    }

    public get isAccepted(): boolean {
        return this.data.status == ComputationStatus.ACCEPTED;
    }

    public get isRejected(): boolean {
        return this.data.status >= ComputationStatus.REJECTED;
    }

    public override refresh(): void {
        super.refresh();
        this._bindClick("accept", this._options.accept);
        this._bindClick("reject", this._options.reject);
        this._bindClick("seed", this._options.toggleSeed);
        this._bindClick("featured", this._options.setAsFeatured);
        this._bindClick("star-0", this._options.setScore.bind(undefined, asNamed(0)));
        this._bindClick("star-1", this._options.setScore.bind(undefined, asNamed(1)));
        this._bindClick("star-2", this._options.setScore.bind(undefined, asNamed(2)));
        this._bindClick("star-3", this._options.setScore.bind(undefined, asNamed(3)));
        this._bindClick("star-4", this._options.setScore.bind(undefined, asNamed(4)));

        // Get elements related to images at the top of the card
        const img: HTMLImageElement = this.querySelector(".card-img-top > img") as HTMLImageElement;
        const containerDiv: HTMLDivElement = img.parentElement! as HTMLDivElement; // Here we know that we have a parent element for sure due to the CSS selector

        if (this.data.attachmentId == null) {
            // No attachment, no src to set for the image
        }
        else {
            img.src = `/attachment/${this.data.attachmentId}`;
        }

        // -- Handle swipe --
        // Handle accept / reject swipe moves
        // Prevent scrolling when touching outside the center of the image
        const feedbackDiv: HTMLDivElement = this.querySelector(".card-img-top > div") as HTMLDivElement;
        containerDiv.addEventListener("touchstart", (ev) => {
            if (ev.touches.length != 1) {
                // Don't care about multi-touch
                this._swipeMode = SwipeMode.NONE;
                return;
            }

            // Get the position of the touch point
            const touch = ev.touches[0];
            const x = touch.clientX;
            // Do a ratio with the image width
            const ratio = x / containerDiv.clientWidth;
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
        containerDiv.addEventListener("touchmove", (ev) => {
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
            const ratio = x / containerDiv.clientWidth;
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
            } else {
                // Nothing to do
            }

            feedbackDiv.style.background = colors[this._swipeMode];
        });
        containerDiv.addEventListener("touchend", (ev) => {
            if (this._swipeMode == SwipeMode.ACCEPT_DONE) {
                // We crossed the accept limit, accept the image
                this._options.accept();
            } else if (this._swipeMode == SwipeMode.REJECT_DONE) {
                // We crossed the reject limit, reject the image
                this._options.reject();
            } else {
                // Nothing to do
            }
            // Reset the swipe mode
            this._swipeMode = SwipeMode.NONE;
            feedbackDiv.style.background = colors[this._swipeMode];
        });
        containerDiv.addEventListener("click", (ev) => {
            ev.stopPropagation();
            // Toggle prompt display
            this.querySelector(".prompt")?.classList.toggle("d-none");
        });
    }

}

customElements.define("custom-picture", PictureElement);
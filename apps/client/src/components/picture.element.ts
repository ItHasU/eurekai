import { ComputationStatus, PictureEntity, PromptEntity } from "@eurekai/shared/src/entities";
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

const ICON_HIGHRES = "bi-aspect-ratio";
const ICON_HIGHRES_COMPUTING = "bi-hourglass-split";
const ICON_HIGHRES_DONE = "bi-badge-hd-fill";

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
        toggleHighres: () => void,
        setAsFeatured: () => void
    }) {
        super(data, require("./picture.element.html").default);
        // Preload the image, it will only be displayed when element is visible
        new Image().src = `/api/attachment/${this.data.attachmentId}`;
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
        this._bindClick("highres", this._options.toggleHighres);
        this._bindClick("featured", this._options.setAsFeatured);
        this._bindClick("sd", this._setDisplay.bind(this, "sd"));
        this._bindClick("hd", this._setDisplay.bind(this, "hd"));
        this._bindClick("both", this._setDisplay.bind(this, "both"));

        // Get elements related to images at the top of the card
        const img_sd: HTMLImageElement = this.querySelector(".card-img-top > img.sd") as HTMLImageElement;
        const img_hd: HTMLImageElement = this.querySelector(".card-img-top > img.hd") as HTMLImageElement;
        const containerDiv: HTMLDivElement = img_sd.parentElement! as HTMLDivElement; // Here we know that we have a parent element for sure due to the CSS selector
        const button_sd = this._getElementByRef("sd")!;
        const button_hd = this._getElementByRef("hd")!;
        const button_both = this._getElementByRef("both")!;

        if (this.data.attachmentId == null) {
            img_sd.remove();
            button_sd.remove();
            button_both.remove();
        }
        else {
            img_sd.src = `/attachment/${this.data.attachmentId}`;
        }
        if (this.data.highresAttachmentId == null) {
            img_hd.remove();
            button_hd.remove();
            button_both.remove();
        } else {
            img_hd.src = `/attachment/${this.data.highresAttachmentId}`;
            this._setDisplay("hd"); // Prefer HD by default
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
        containerDiv.addEventListener("touchend", (ev) => {
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
        const highresButton: HTMLButtonElement = this._getElementByRef("highres") as HTMLButtonElement;
        const highresIcon: HTMLSpanElement = highresButton.querySelector("i") as HTMLElement;
        highresIcon.classList.remove(ICON_HIGHRES, ICON_HIGHRES_COMPUTING, ICON_HIGHRES_DONE);
        switch (this.data.highresStatus) {
            case ComputationStatus.NONE:
                highresIcon.classList.add(ICON_HIGHRES);
                highresButton.disabled = false;
                break;
            case ComputationStatus.PENDING:
                highresIcon.classList.add(ICON_HIGHRES_COMPUTING);
                highresButton.disabled = false;
                break;
            case ComputationStatus.DONE:
                highresIcon.classList.add(ICON_HIGHRES_DONE);
                highresButton.disabled = true;
                break;
            case ComputationStatus.ERROR:
                highresIcon.classList.add(ICON_HIGHRES_DONE, "text-danger");
                highresButton.disabled = false;
                break;
            case ComputationStatus.REJECTED:
                highresIcon.classList.add(ICON_HIGHRES_DONE, "text-muted");
                highresButton.disabled = false;
                break;
        }
    }

    protected _setDisplay(buttonRef: "sd" | "hd" | "both"): void {
        const img_sd: HTMLImageElement = this.querySelector(".card-img-top > img.sd") as HTMLImageElement;
        const img_hd: HTMLImageElement = this.querySelector(".card-img-top > img.hd") as HTMLImageElement;
        // Toggle images visibility
        img_sd.style.display = buttonRef !== "hd" ? "block" : "none";
        img_hd.style.display = buttonRef !== "sd" ? "block" : "none";
        // Toggle button active state
        this._getElementByRef("display")?.querySelectorAll("button").forEach(btn => btn.classList.remove("active"));
        this._getElementByRef(buttonRef)?.classList.add("active");
        img_sd.style.opacity = buttonRef === "both" ? "0.6" : "";
    }
}

customElements.define("custom-picture", PictureElement);
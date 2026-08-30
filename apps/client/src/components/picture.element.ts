import { asNamed } from "@dagda/shared/entities/named.types";
import { EventHandler, EventHandlerData, EventHandlerImpl, EventListener } from "@dagda/shared/tools/events";
import { ComputationStatus, PictureEntity, PictureType, PromptEntity, Score } from "@eurekai/shared/src/entities";
import { AbstractDTOElement } from "./abstract.dto.element";
import { PromptEvents } from "./prompt.element";
import { htmlStringToElement } from "./tools";

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

/** Max delay between the two clicks/taps of a dblclick/double tap, in ms */
const DOUBLE_CLICK_DELAY = 200;

type PictureEvents = Pick<PromptEvents, "clone">;

export class PictureElement extends AbstractDTOElement<PictureEntity> implements EventHandler<PictureEvents> {

    constructor(data: PictureEntity, public readonly _options: {
        prompt: PromptEntity,
        /** Pass true so image can be blurred if app is locked */
        isLockable: boolean,
        isPreferredSeed: boolean,
        accept: () => void,
        reject: () => void,
        toggleSeed: () => void,
        setAsFeatured: () => void,
        useAsSource: () => void,
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

    /** A video cannot be used as a $image$ source (base64 img2img input), only a still image can */
    public get canUseAsSource(): boolean {
        return this.data.attachmentId != null && this.data.type === PictureType.IMAGE;
    }

    //#region Events ----------------------------------------------------------

    protected _eventData: EventHandlerData<PictureEvents> = {};

    public on<EventName extends keyof PictureEvents>(eventName: EventName, listener: EventListener<PictureEvents[EventName]>): void {
        EventHandlerImpl.on(this._eventData, eventName, listener);
    }

    //#endregion

    public override refresh(): void {
        super.refresh();
        this._bindClick("accept", this._options.accept);
        this._bindClick("reject", this._options.reject);
        this._bindClick("seed", this._options.toggleSeed);
        this._bindClick("featured", this._options.setAsFeatured);
        this._bindClick("useAsSource", this._options.useAsSource);
        this._bindClick("clone", () => {
            EventHandlerImpl.fire(this._eventData, "clone", { prompt: this._options.prompt, seed: this.data.seed });
        });
        this._bindClick("star-0", this._options.setScore.bind(undefined, asNamed(0)));
        this._bindClick("star-1", this._options.setScore.bind(undefined, asNamed(1)));
        this._bindClick("star-2", this._options.setScore.bind(undefined, asNamed(2)));
        this._bindClick("star-3", this._options.setScore.bind(undefined, asNamed(3)));
        this._bindClick("star-4", this._options.setScore.bind(undefined, asNamed(4)));

        // Get elements related to images at the top of the card
        const containerDiv = this._getElementByRef<HTMLDivElement>("picturePlaceholder")!;
        if (this.data.attachmentId == null) {
            // No attachment, don't show anything
            return;
        }
        switch (this.data.type) {
            case PictureType.UNKNOWN: {
                // FIXME video
                break;
            }

            case PictureType.IMAGE: {
                // The grid displays many pictures at once, so it asks for the downscaled
                // version : the server generates it on the first request and redirects to the
                // full size image when it has none to offer.
                // Lazy : the browser only fetches the image once it nears the viewport, instead
                // of downloading every picture on the page at once. Async decoding keeps a large
                // batch of images loading in from blocking the main thread.
                const img: HTMLImageElement = htmlStringToElement<HTMLImageElement>(`<img class="w-100 h-100" src="/attachment/${this.data.attachmentId}/thumbnail" loading="lazy" decoding="async">`)!;
                containerDiv.append(img);
                this._bindFullSizeAndPromptInteractions(containerDiv);
                break;
            }

            case PictureType.VIDEO: {
                // preload="none" : only fetch the video once the user actually plays it, instead
                // of every visible <video> tag eagerly buffering data as soon as it is rendered.
                // The poster is a still frame extracted server side, so the grid shows what the
                // video looks like without downloading any of it.
                const video: HTMLVideoElement = htmlStringToElement<HTMLVideoElement>(`<video class="w-100 h-100" src="/attachment/${this.data.attachmentId}" poster="/attachment/${this.data.attachmentId}/thumbnail" muted controls playsinline disableremoteplayback disablepictureinpicture preload="none"></video>`)!;
                function restoreControls() {
                    setTimeout(() => {
                        video.controls = true;
                    }, 750); // Leave some time for user to appreciate the end of the video
                }
                video.addEventListener("play", () => {
                    video.controls = false;
                });
                video.addEventListener("ended", restoreControls);
                video.addEventListener("pause", restoreControls);
                containerDiv.append(video);
                break;
            }

            default: {
                // Not implemented
                const text: HTMLParagraphElement = htmlStringToElement<HTMLParagraphElement>(`<p>Not implemented (${this.data.type})</p>`)!;
                containerDiv.append(text);
                break;
            }
        }


        // -- Handle swipe --
        // Handle accept / reject swipe moves
        // Prevent scrolling when touching outside the center of the image
        const feedbackDiv: HTMLDivElement = this.querySelector(".card-img-top > div") as HTMLDivElement;

        bindTouchEvents(containerDiv, feedbackDiv, this._options);
        if (this.data.type !== PictureType.IMAGE) {
            // Images get the full click/dblclick/tap/double tap state machine below instead
            containerDiv.addEventListener("dblclick", (ev) => {
                ev.stopPropagation();
                this.querySelector(".prompt")?.classList.toggle("d-none");
            });
        }
    }

    /** @see _bindFullSizeAndPromptInteractions */
    protected _clickTimeoutId: number | undefined;
    /** @see _bindFullSizeAndPromptInteractions */
    protected _tapTimeoutId: number | undefined;
    /** @see _bindFullSizeAndPromptInteractions */
    protected _lastTapTime: number = 0;

    /**
     * Wire up the interactions that show/hide the full size preview and the prompt overlay.
     *
     * Desktop : click opens the full image, dblclick opens the prompt.
     * Touch : tap opens the prompt, double tap opens the full image (the reverse of desktop,
     * because a stray tap while scrolling is much more likely than a stray click).
     * Either way, an interaction while the prompt is showing closes it instead of opening
     * anything ; closing the full image preview itself is handled where it is created, since
     * it sits in its own overlay the tap/click below never sees.
     *
     * Touch cannot simply piggyback on the click/dblclick a browser synthesizes from taps,
     * since tap and click must resolve to different actions here : the touch handling below
     * calls preventDefault so that synthetic click/dblclick never fires and fights it.
     */
    protected _bindFullSizeAndPromptInteractions(containerDiv: HTMLElement): void {
        containerDiv.addEventListener("click", () => {
            // Each click of a dblclick pair lands here too : clear the previous one's timeout,
            // otherwise it fires on its own after DOUBLE_CLICK_DELAY, running the click action anyway.
            if (this._clickTimeoutId != null) {
                window.clearTimeout(this._clickTimeoutId);
            }
            this._clickTimeoutId = window.setTimeout(() => {
                this._clickTimeoutId = undefined;
                this._handleInteraction("click");
            }, DOUBLE_CLICK_DELAY);
        });
        containerDiv.addEventListener("dblclick", (ev) => {
            ev.stopPropagation();
            if (this._clickTimeoutId != null) {
                window.clearTimeout(this._clickTimeoutId);
                this._clickTimeoutId = undefined;
            }
            this._handleInteraction("dblclick");
        });

        // Only a tap in the center counts : the edges are the accept/reject swipe zones
        let tapCandidate = false;
        containerDiv.addEventListener("touchstart", (ev) => {
            if (ev.touches.length !== 1) {
                tapCandidate = false;
                return;
            }
            const ratio = ev.touches[0].clientX / containerDiv.clientWidth;
            tapCandidate = ratio >= ACTION_SWIPE_MARGIN && ratio <= (1 - ACTION_SWIPE_MARGIN);
        });
        containerDiv.addEventListener("touchend", (ev) => {
            if (!tapCandidate) {
                return;
            }
            // Stop the browser from also firing a synthetic click/dblclick for this tap
            ev.preventDefault();
            if (this._tapTimeoutId != null) {
                window.clearTimeout(this._tapTimeoutId);
                this._tapTimeoutId = undefined;
            }
            const now = Date.now();
            if (now - this._lastTapTime < DOUBLE_CLICK_DELAY) {
                this._lastTapTime = 0;
                this._handleInteraction("doubletap");
            } else {
                this._lastTapTime = now;
                this._tapTimeoutId = window.setTimeout(() => {
                    this._tapTimeoutId = undefined;
                    this._handleInteraction("tap");
                }, DOUBLE_CLICK_DELAY);
            }
        });
    }

    /** @see _bindFullSizeAndPromptInteractions */
    protected _handleInteraction(kind: "click" | "dblclick" | "tap" | "doubletap"): void {
        const promptDiv = this.querySelector(".prompt");
        const promptShown = promptDiv != null && !promptDiv.classList.contains("d-none");
        if (promptShown) {
            // Anything closes an already shown prompt, whatever the gesture
            promptDiv.classList.add("d-none");
            return;
        }
        if (kind === "click" || kind === "doubletap") {
            this._openFullSizePreview();
        } else {
            promptDiv?.classList.remove("d-none");
        }
    }

    /** Show the original, full resolution image over everything. Click/tap it again to close. */
    protected _openFullSizePreview(): void {
        if (this.data.attachmentId == null) {
            return;
        }
        const overlay: HTMLDivElement = htmlStringToElement<HTMLDivElement>(`<div style="position:fixed; inset:0; z-index:1050; background:rgba(0,0,0,0.9); display:flex; align-items:center; justify-content:center; cursor:zoom-out;">
            <img src="/attachment/${this.data.attachmentId}" style="max-width:100%; max-height:100%; object-fit:contain;">
        </div>`)!;
        overlay.addEventListener("click", () => overlay.remove());
        document.body.append(overlay);
    }

}

customElements.define("custom-picture", PictureElement);

/** Function to add generic Accept/Reject gestures on a picture */
export function bindTouchEvents(containerDiv: HTMLElement, feedbackDiv: HTMLDivElement, _options: {
    accept: () => void,
    reject: () => void,
}): void {
    let _swipeMode: SwipeMode = SwipeMode.NONE;

    containerDiv.addEventListener("touchstart", (ev) => {
        if (ev.touches.length != 1) {
            // Don't care about multi-touch
            _swipeMode = SwipeMode.NONE;
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
            _swipeMode = SwipeMode.REJECT_STARTED;
            ev.preventDefault();
        } else if (ratio > (1 - ACTION_SWIPE_MARGIN)) {
            // Prevent scrolling, show accept icon
            _swipeMode = SwipeMode.ACCEPT_STARTED;
            ev.preventDefault();
        } else {
            // At the center, leave the default behavior
            _swipeMode = SwipeMode.NONE;
        }
        feedbackDiv.style.background = colors[_swipeMode];
    });
    containerDiv.addEventListener("touchmove", (ev) => {
        if (ev.touches.length < 1) {
            // Don't care about multi-touch
            _swipeMode = SwipeMode.NONE;
            feedbackDiv.style.background = colors[_swipeMode];
            return;
        }

        if (_swipeMode != SwipeMode.NONE) {
            // Prevent default behavior
            ev.preventDefault();
        }

        // Get the position of the touch point
        const touch = ev.touches[0];
        const x = touch.clientX;
        // Do a ratio with the image width
        const ratio = x / containerDiv.clientWidth;
        // If the touch is in the center of the image
        if (_swipeMode == SwipeMode.REJECT_STARTED && ratio > ACTION_SWIPE_MARGIN) {
            // We crossed the accept limit, reject the image
            _swipeMode = SwipeMode.REJECT_DONE;
        } else if (_swipeMode == SwipeMode.REJECT_DONE && ratio < ACTION_SWIPE_MARGIN) {
            // Cancel the reject mode
            _swipeMode = SwipeMode.REJECT_STARTED;
        } else if (_swipeMode == SwipeMode.ACCEPT_STARTED && ratio < (1 - ACTION_SWIPE_MARGIN)) {
            // We crossed the reject limit, accept the image
            _swipeMode = SwipeMode.ACCEPT_DONE;
        } else if (_swipeMode == SwipeMode.ACCEPT_DONE && ratio > (1 - ACTION_SWIPE_MARGIN)) {
            // Cancel the accept mode
            _swipeMode = SwipeMode.ACCEPT_STARTED;
        } else {
            // Nothing to do
        }

        feedbackDiv.style.background = colors[_swipeMode];
    });
    containerDiv.addEventListener("touchend", (ev) => {
        if (_swipeMode == SwipeMode.ACCEPT_DONE) {
            // We crossed the accept limit, accept the image
            _options.accept();
        } else if (_swipeMode == SwipeMode.REJECT_DONE) {
            // We crossed the reject limit, reject the image
            _options.reject();
        } else {
            // Nothing to do
        }
        // Reset the swipe mode
        _swipeMode = SwipeMode.NONE;
        feedbackDiv.style.background = colors[_swipeMode];
    });
}
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
                const img: HTMLImageElement = htmlStringToElement<HTMLImageElement>(`<img class="w-100 h-100" src="/attachment/${this.data.attachmentId}">`)!;
                containerDiv.append(img);
                break;
            }

            case PictureType.VIDEO: {
                const video: HTMLVideoElement = htmlStringToElement<HTMLVideoElement>(`<video class="w-100 h-100" src="/attachment/${this.data.attachmentId}" muted controls playsinline disableremoteplayback disablepictureinpicture></video>`)!;
                video.addEventListener("play", () => {
                    video.controls = false;
                });
                video.addEventListener("ended", () => {
                    video.controls = true;
                });
                video.addEventListener("pause", () => {
                    video.controls = true;
                });
                containerDiv.append(video);
                break;
            }

            default:
                // Not implemented
                const text: HTMLParagraphElement = htmlStringToElement<HTMLParagraphElement>(`<p>Not implemented (${this.data.type})</p>`)!;
                containerDiv.append(text);
                break;
        }


        // -- Handle swipe --
        // Handle accept / reject swipe moves
        // Prevent scrolling when touching outside the center of the image
        const feedbackDiv: HTMLDivElement = this.querySelector(".card-img-top > div") as HTMLDivElement;

        bindTouchEvents(containerDiv, feedbackDiv, this._options);
        containerDiv.addEventListener("dblclick", (ev) => {
            ev.stopPropagation();
            // Toggle prompt display
            this.querySelector(".prompt")?.classList.toggle("d-none");
        });
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
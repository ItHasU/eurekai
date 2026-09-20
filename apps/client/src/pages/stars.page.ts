import { asNamed } from "@dagda/shared/entities/named.types";
import { PictureEntity, PictureId, PictureType, ProjectId, Score } from "@eurekai/shared/src/entities";
import { APP } from "src";
import { StaticDataProvider } from "src/tools/dataProvider";
import { AbstractPageElement } from "./abstract.page.element";
import { PicturesPage } from "./pictures.page";

/** An image or a video displayed by the page */
type MediaElement = HTMLImageElement | HTMLVideoElement;

/** Preview of a score, showing one of the pictures already rated with that score */
interface StarPreview {
    /** Container of the preview, the media is appended into it */
    div: HTMLDivElement;
    /** Media currently displayed, null when no picture has that score yet */
    media: MediaElement | null;
    /** Id of the picture displayed, used to avoid reloading the same media on a refresh */
    pictureId: PictureId | null;
}

/**
 * Detach a media element and release the data it holds.
 *
 * Dropping the element is not enough : as long as the browser considers the media as loaded,
 * it keeps the decoded frames and, for a video, the whole buffered stream (several MB each) in
 * memory. Evaluating a handful of videos was enough to make the page grow out of control.
 */
function releaseMedia(media: MediaElement | null): void {
    if (media == null) {
        return;
    }
    media.remove();
    if (media instanceof HTMLVideoElement) {
        media.pause();
        // Removing the attribute then calling load() is what actually frees the buffers.
        // Setting src to an empty string would instead make the browser load the page itself.
        media.removeAttribute("src");
        media.load();
    } else {
        media.removeAttribute("src");
    }
}

/**
 * Build the element displaying a picture : a <video> for a video, an <img> otherwise.
 *
 * Thumbnails are server side downscaled versions (a poster frame for a video), so a preview
 * never downloads the full size media.
 */
function createMedia(picture: PictureEntity, options: { thumbnail: boolean, lockable: boolean }): MediaElement {
    const url = `/attachment/${picture.attachmentId}`;
    let media: MediaElement;
    if (!options.thumbnail && picture.type === asNamed(PictureType.VIDEO)) {
        const video = document.createElement("video");
        video.muted = true;
        video.autoplay = true;
        video.loop = true;
        video.playsInline = true;
        video.disableRemotePlayback = true;
        video.setAttribute("disablepictureinpicture", "");
        video.src = url;
        media = video;
    } else {
        const img = document.createElement("img");
        // Async decoding keeps the decoding of a large picture from blocking the main thread
        img.decoding = "async";
        img.src = options.thumbnail ? `${url}/thumbnail` : url;
        media = img;
    }
    media.classList.add("img-fluid");
    media.classList.toggle("lockable", options.lockable);
    media.style.maxHeight = "100%";
    return media;
}

/** Display pictures one by one and let the user rate them from 1 to 4 stars */
export class StarsPage extends AbstractPageElement {

    protected _picturesToScore: PictureEntity[] = [];

    /** True when the pictures of the project are blurred once the app is locked */
    protected _lockable: boolean = false;

    protected readonly _pictureContainer: HTMLDivElement;
    /** Media of the picture being rated, moved to a preview once rated */
    protected _pictureMedia: MediaElement | null = null;
    protected _pictureId: PictureId | null = null;

    protected readonly _previews: StarPreview[];

    protected readonly _keydownCallback = this._onKeydownCallback.bind(this);

    constructor() {
        super(require("./stars.page.html").default);
        this.classList.add("d-flex", "h-100");

        // -- Get components --
        this._pictureContainer = this.querySelector("#pictureContainer") as HTMLDivElement;
        this._previews = [];
        for (let i = 1; i <= 4; i++) {
            const div = this.querySelector(`#star-${i}`) as HTMLDivElement;
            this._previews.push({ div, media: null, pictureId: null });
            const score = i as 0 | 1 | 2 | 3 | 4;
            div.addEventListener("click", () => {
                Promise.resolve().then(async () => {
                    await this._affectScore(asNamed(score));
                }).catch(e => console.error(e));
            });
        }
    }

    public override connectedCallback(): void {
        super.connectedCallback();

        // Bind keyboard callback when connected
        window.addEventListener("keydown", this._keydownCallback);
    }

    public disconnectedCallback(): void {
        // Unbind keyboard callback when disconnected to avoid triggering callbacks when done
        window.removeEventListener("keydown", this._keydownCallback);

        // Leaving the page must not leave a video downloading in the background
        this._clearPicture();
        for (const preview of this._previews) {
            releaseMedia(preview.media);
            preview.media = null;
            preview.pictureId = null;
        }
    }

    /** @inheritdoc */
    protected override async _refresh(): Promise<void> {
        // -- Make sure cache is updated --
        const projectId = StaticDataProvider.getSelectedProject();

        if (projectId == null) {
            APP.setPage(PicturesPage);
            return;
        }

        // -- Async part ------------------------------------------------------
        await StaticDataProvider.getModels();
        await StaticDataProvider.entitiesHandler.fetch({
            type: "project",
            options: {
                projectId
            }
        });

        // -- Render data -----------------------------------------------------
        this._refreshImpl(projectId);
    }

    /** Render data from the cache (does not reload data) */
    protected _refreshImpl(projectId: ProjectId): void {
        const project = StaticDataProvider.entitiesHandler.getById("projects", projectId);
        this._lockable = project?.lockable === true;

        // -- Sort pictures by stars count --
        const map: Map<Score, PictureEntity[]> = new Map();
        for (const picture of StaticDataProvider.entitiesHandler.getItems("pictures")) {
            if (picture.attachmentId == null) {
                // Nothing to display (not generated yet, or generation failed)
                continue;
            }
            if (picture.type !== asNamed(PictureType.IMAGE) && picture.type !== asNamed(PictureType.VIDEO)) {
                // Only images and videos can be displayed
                continue;
            }
            const prompt = StaticDataProvider.entitiesHandler.getById("prompts", picture.promptId);
            if (!StaticDataProvider.entitiesHandler.isSameId(prompt?.projectId, projectId)) {
                // Not the current projectId
                continue;
            }
            const arr = map.get(picture.score) ?? [];
            map.set(picture.score, arr);
            arr.push(picture);
        }

        // -- Display images for targets --
        // Done before the next picture as leaving the page here would release its media
        for (let i = 0; i < this._previews.length; i++) {
            const preview = this._previews[i];
            const score = (i + 1) as 0 | 1 | 2 | 3 | 4;
            const pictures = map.get(asNamed(score)) ?? [];
            if (preview.pictureId != null && pictures.some(picture => StaticDataProvider.entitiesHandler.isSameId(picture.id, preview.pictureId))) {
                // The preview still shows a picture of that score, keep it loaded as it is
                continue;
            }
            if (pictures.length === 0) {
                this._setPreview(i, null, null);
            } else {
                this._setPreview(i, pictures[Math.floor(Math.random() * pictures.length)], null);
            }
        }

        // -- Display next image to assign --
        this._picturesToScore = map.get(asNamed(0)) ?? [];
        this._displayNextIfNeeded();
    }

    /**
     * Display the next picture to rate.
     * If no more picture, will redirect the user to the pictures page.
     *
     * Warning: The attribute _picturesToScore needs to be set before calling the method.
     */
    protected _displayNextIfNeeded(): boolean {
        const picture = this._picturesToScore[0];
        if (picture == null) {
            // Go back to pictures page when done
            this._clearPicture();
            APP.setPage(PicturesPage);
            return false;
        }

        if (this._pictureMedia != null && StaticDataProvider.entitiesHandler.isSameId(this._pictureId, picture.id)) {
            // Already displayed, don't download it again (refresh() is called on every update)
            return true;
        }

        this._clearPicture();
        this._pictureMedia = createMedia(picture, { thumbnail: false, lockable: this._lockable });
        this._pictureId = picture.id;
        this._pictureContainer.appendChild(this._pictureMedia);
        return true;
    }

    /** Release the media of the picture being rated */
    protected _clearPicture(): void {
        releaseMedia(this._pictureMedia);
        this._pictureMedia = null;
        this._pictureId = null;
    }

    /**
     * Set the picture displayed as the reference of a score.
     *
     * When the media of the picture is passed, it is moved into the preview instead of being
     * created again : it is already downloaded and decoded, so the preview shows up instantly
     * and costs nothing. It is then swapped with the thumbnail once that one is ready, so a
     * preview never keeps a full size picture, let alone a whole video, loaded.
     */
    protected _setPreview(index: number, picture: PictureEntity | null, media: MediaElement | null): void {
        const preview = this._previews[index];
        const previousMedia = preview.media;
        preview.media = null;
        preview.pictureId = picture?.id ?? null;

        if (picture == null) {
            releaseMedia(previousMedia);
            return;
        }

        const thumbnail = createMedia(picture, { thumbnail: true, lockable: this._lockable });
        if (media == null) {
            // Nothing to move, display the thumbnail right away
            releaseMedia(previousMedia);
            preview.media = thumbnail;
            preview.div.appendChild(thumbnail);
            return;
        }

        if (media instanceof HTMLVideoElement) {
            // A preview is not meant to play, and playing would keep on downloading the video
            media.pause();
        }
        releaseMedia(previousMedia);
        preview.media = media;
        preview.div.appendChild(media);

        // Replace the moved media with the thumbnail once it is loaded, and only then, so the
        // preview is never empty. If the thumbnail fails to load, the moved media is kept.
        thumbnail.addEventListener("load", () => {
            if (preview.media !== media) {
                // The preview changed in the meantime, the media has already been released
                return;
            }
            preview.media = thumbnail;
            preview.div.appendChild(thumbnail);
            releaseMedia(media);
        });
    }

    protected async _affectScore(score: Score): Promise<void> {
        const picture = this._picturesToScore[0];
        if (picture == null) {
            // Go back to pictures page when done
            APP.setPage(PicturesPage);
            return;
        }

        // -- Move to the next picture --
        // Done synchronously so that rating faster than the server answers cannot rate the
        // same picture twice, and so the user gets an immediate feedback.
        const media = this._pictureMedia;
        this._picturesToScore.shift();
        this._pictureMedia = null;
        this._pictureId = null;

        // -- Set picture as new score reference --
        this._setPreview(score - 1, picture, media);

        this._displayNextIfNeeded();

        // -- Set score --
        await StaticDataProvider.entitiesHandler.withTransaction(tr => {
            tr.update("pictures", picture, { score });
        });
    }

    protected _onKeydownCallback(evt: KeyboardEvent): void {
        Promise.resolve().then(async () => {
            switch (evt.key) {
                case "1":
                case "&": // Here is the key for 1 on a French keyboard
                    await this._affectScore(asNamed(1));
                    break;
                case "2":
                case "é": // Here is the key for 2 on a French keyboard
                    await this._affectScore(asNamed(2));
                    break;
                case "3":
                case "\"": // Here is the key for 3 on a French keyboard
                    await this._affectScore(asNamed(3));
                    break;
                case "4":
                case "'": // Here is the key for 4 on a French keyboard
                    await this._affectScore(asNamed(4));
                    break;
            }
        }).catch(e => console.error(e));
    }
}

customElements.define("stars-page", StarsPage);

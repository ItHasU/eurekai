import { asNamed } from "@dagda/shared/entities/named.types";
import { PictureEntity, ProjectId, Score } from "@eurekai/shared/src/entities";
import { APP } from "src";
import { StaticDataProvider } from "src/tools/dataProvider";
import { AbstractPageElement } from "./abstract.page.element";
import { PicturesPage } from "./pictures.page";

/** Display projects and fire an event on project change */
export class StarsPage extends AbstractPageElement {

    protected _picturesToScore: PictureEntity[] | null = null;

    protected readonly _pictureImg: HTMLImageElement;
    protected readonly _starDivs: { div: HTMLDivElement, img: HTMLImageElement }[];

    protected readonly _keydownCallback = this._onKeydownCallback.bind(this);

    constructor() {
        super(require("./stars.page.html").default);
        this.classList.add("d-flex", "h-100");

        // -- Get components --
        this._pictureImg = this.querySelector("#pictureImg") as HTMLImageElement;
        this._starDivs = [];
        for (let i = 1; i <= 4; i++) {
            const div = this.querySelector(`#star-${i}`) as HTMLDivElement;
            const img = div.querySelector("img") as HTMLImageElement;
            this._starDivs.push({ div, img });
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
        // -- Sort pictures by stars count --
        const map: Map<Score, PictureEntity[]> = new Map();
        for (const picture of StaticDataProvider.entitiesHandler.getItems("pictures")) {
            const prompt = StaticDataProvider.entitiesHandler.getById("prompts", picture.promptId);
            if (!StaticDataProvider.entitiesHandler.isSameId(prompt?.projectId, projectId)) {
                // Not the current projectId
                continue;
            }
            const arr = map.get(picture.score) ?? [];
            map.set(picture.score, arr);
            arr.push(picture);
        }
        // -- Display next image to assign --
        this._picturesToScore = map.get(asNamed(0)) ?? null;
        if (!this._displayNextImageIfNeeded()) {
            // No image to display, exit
            return;
        }

        // -- Display images for targets --
        for (let i = 0; i < this._starDivs.length; i++) {
            const score = (i + 1) as 0 | 1 | 2 | 3 | 4;
            const pictures = map.get(asNamed(score));
            if (pictures?.length) {
                const randomPic = pictures[Math.floor(Math.random() * pictures.length)];
                this._starDivs[i].img.src = `/attachment/${randomPic.attachmentId}`;
            } else {
                this._starDivs[i].img.src = "";
            }
        }
    }

    /** 
     * Display next image to score.
     * If no more image, will redirect the user to the pictures page.
     * 
     * Warning: The attribute _picturesToScore needs to be set before calling the method.
     */
    protected _displayNextImageIfNeeded(): boolean {
        if (!this._picturesToScore?.length) {
            // Go back to pictures page when done
            APP.setPage(PicturesPage);
            return false;
        }

        this._pictureImg.src = `/attachment/${this._picturesToScore[0].attachmentId}`;
        return true;
    }

    protected async _affectScore(score: Score): Promise<void> {
        if (!this._picturesToScore?.length) {
            // Go back to pictures page when done
            APP.setPage(PicturesPage);
            return;
        }

        // -- Set score --
        const picture = this._picturesToScore[0];
        await StaticDataProvider.entitiesHandler.withTransaction(tr => {
            tr.update("pictures", picture, { score });
        });

        // -- Set picture as new Score reference --
        const index = score - 1;
        this._starDivs[index].img.src = `/attachment/${picture.attachmentId}`;

        // Remove the first item
        this._picturesToScore.splice(0, 1);
        this._displayNextImageIfNeeded();
    }

    protected _onKeydownCallback(evt: KeyboardEvent): void {
        Promise.resolve().then(async () => {
        }).catch(e => console.error(e));
    }
}

customElements.define("stars-page", StarsPage);
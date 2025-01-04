import { asNamed } from "@dagda/shared/entities/named.types";
import { SQLTransaction } from "@dagda/shared/sql/transaction";
import { AppContexts, AppTables, AttachmentId, ComputationStatus, PictureEntity, ProjectEntity, ProjectId, PromptEntity, Score, Seed } from "@eurekai/shared/src/entities";
import { deletePicture, generateNextPictures, isPreferredSeed, togglePreferredSeed, unstarPicture, zipPictures } from "@eurekai/shared/src/pictures.data";
import { APP } from "src";
import { PictureElement } from "src/components/picture.element";
import { PromptElement } from "src/components/prompt.element";
import { ScoreElement } from "src/components/score.element";
import { SeedElement } from "src/components/seed.element";
import { showConfirm } from "src/components/tools";
import { PromptEditor } from "src/editors/prompt.editor";
import { StaticDataProvider } from "src/tools/dataProvider";
import { AbstractPageElement } from "./abstract.page.element";
import { QuickPage } from "./quick.page";
import { StarsPage } from "./stars.page";

enum GroupMode {
    PROMPT,
    SEED,
    STARS
}

function scrollToNextSibling(node: HTMLElement): void {
    const parent = node.parentElement;
    if (!parent) {
        return;
    }

    const next = node.nextElementSibling as HTMLElement | null;
    if (next && next.tagName === node.tagName) {
        next.scrollIntoView({
            behavior: "smooth"
        });
    } else {
        // We are done
    }
}

/** Display projects and fire an event on project change */
export class PicturesPage extends AbstractPageElement {

    protected readonly _picturesDiv: HTMLDivElement;
    protected readonly _picturesFilterSelect: HTMLSelectElement;
    protected readonly _promptCard: HTMLDivElement;
    protected readonly _promptEditor: PromptEditor;

    protected _isFirstDisplay: boolean = true;
    protected _group: GroupMode = GroupMode.PROMPT;

    constructor() {
        super(require("./pictures.page.html").default);

        // -- Get components --
        this._picturesDiv = this.querySelector("#picturesDiv") as HTMLDivElement;
        this._picturesFilterSelect = this.querySelector("#picturesFilterSelect") as HTMLSelectElement;

        this._promptCard = this.querySelector("#promptCard") as HTMLDivElement;
        this._promptEditor = this.querySelector("#promptEditor") as PromptEditor;

        // -- Bind callbacks for buttons --
        this._bindClickForRef("addPromptButton", this._openPromptPanel.bind(this));
        this._bindClickForRef("closePromptButton", this._closePromptPanel.bind(this));
        this._bindClickForRef("newPromptButton", this._onNewPromptClick.bind(this));
        this._bindClickForRef("zipButton", this._onZipClick.bind(this));
        this._bindClickForRef("quickButton", this._onQuickClick.bind(this));
        this._bindClickForRef("starsButton", this._onStarsClick.bind(this));
        this._bindClickForRef("resetStarsButton", this._onResetStarsClick.bind(this));
        this._bindClickForRef("clearRejectedButton", this._onClearRejectedButtonClick.bind(this));
        this._bindClickForRef("groupByPromptButton", this._toggleGroupMode.bind(this, GroupMode.PROMPT));
        this._bindClickForRef("groupBySeedButton", this._toggleGroupMode.bind(this, GroupMode.SEED));
        this._bindClickForRef("groupByStarsButton", this._toggleGroupMode.bind(this, GroupMode.STARS));
        this._picturesFilterSelect.addEventListener("change", this.refresh.bind(this, false));
    }

    /** @inheritdoc */
    protected override async _refresh(): Promise<void> {
        // -- Make sure cache is updated --
        const projectId = StaticDataProvider.getSelectedProject();

        if (projectId == null) {
            return;
        }

        // -- Async part ------------------------------------------------------
        await StaticDataProvider.getModels();
        const dataWereLoaded = await StaticDataProvider.entitiesHandler.fetch({
            type: "project",
            options: {
                projectId
            }
        });

        // -- Render data -----------------------------------------------------
        this._refreshImpl(projectId);

        // -- Scroll to top ---------------------------------------------------
        if (dataWereLoaded) {
            this._picturesDiv.scrollTo(0, 0);
        }
    }

    /** Render data from the cache (does not reload data) */
    protected _refreshImpl(projectId: ProjectId): void {
        // -- Clear -----------------------------------------------------------
        this._picturesDiv.innerHTML = "";

        // -- Prepare data ----------------------------------------------------
        // Project
        const project = StaticDataProvider.entitiesHandler.getCache("projects").getById(projectId)
        if (project == null) {
            // Nothing to display
            return;
        }

        // Set mode to STARS is unpinned (means not currently active)
        if (this._isFirstDisplay) {
            this._isFirstDisplay = false;
            if (project.lockable) {
                this._picturesFilterSelect.value = "none";
            }
            if (project.pinned === false) {
                this._group = GroupMode.STARS;
            }
        }

        // Prompts for the project (there might be others in cache)
        const prompts = StaticDataProvider.entitiesHandler.getItems("prompts").filter(prompt => prompt.projectId === projectId);
        const promptsMap: { [id: number]: { prompt: PromptEntity, pictures: PictureEntity[] } } = {};
        for (const prompt of prompts) {
            promptsMap[prompt.id] = { prompt, pictures: [] };
        }
        // Pictures for the project (the ones associated to prompts of the project)
        const pictures: PictureEntity[] = [];
        for (const picture of StaticDataProvider.entitiesHandler.getItems("pictures")) {
            const promptId = StaticDataProvider.entitiesHandler.getUpdatedId(picture.promptId);
            if (promptId == null) {
                // Prompt is not from the project since the map
                // only contains prompts from the project
                continue;
            }
            const promptForPicture = promptsMap[promptId];
            if (promptForPicture == null) {
                // Prompt is not from the project since the map
                // only contains prompts from the project
            } else if (!StaticDataProvider.entitiesHandler.isSameId(promptForPicture.prompt.projectId, projectId)) {
                // Prompt is not from project 
                // (should never happen since prompt in map are already filtered)
            } else {
                promptForPicture.pictures.push(picture);
                pictures.push(picture);
            }
        }

        // -- Preferred seeds --
        const preferredSeeds: Set<number> = new Set(StaticDataProvider.entitiesHandler.getItems("seeds").filter(s => StaticDataProvider.entitiesHandler.isSameId(s.projectId, projectId)).map(s => s.seed));
        // -- Get the filter --
        const filter: (picture: PictureEntity) => boolean = this._getFilter(preferredSeeds);

        if (this._group === GroupMode.PROMPT) {
            // -- Render per prompt -------------------------------------------
            // Sort prompts per order index (inverted)
            prompts.sort((p1, p2) => {
                let res = 0;

                if (res === 0) {
                    // Reverse order
                    return -(p1.orderIndex - p2.orderIndex);
                }

                if (res === 0) {
                    return p1.id - p2.id;
                }

                return res;
            });

            for (const prompt of prompts) {
                // -- Add a line break --
                const div = document.createElement("div");
                div.classList.add("w-100");
                this._picturesDiv.appendChild(div);

                // -- Render prompt --
                const promptItem = new PromptElement(prompt);
                promptItem.on("clone", (evt) => {
                    this._openPromptPanel(evt.data.prompt, evt.data.seed);
                });
                promptItem.on("delete", () => {
                    this.refresh();
                });

                promptItem.classList.add("col-12");
                promptItem.refresh();
                this._picturesDiv.appendChild(promptItem);

                // -- Render images --
                const picturesForPrompt = (promptsMap[prompt.id]?.pictures ?? []).filter(filter);
                picturesForPrompt.sort((i1, i2) => { return -(i1.id - i2.id); });
                for (const picture of picturesForPrompt) {
                    // -- Add the picture --
                    const item = this._buildPictureElement(picture, prompt, project, promptItem);
                    item.classList.add("col-sm-12", "col-md-6", "col-lg-3");
                    this._picturesDiv.appendChild(item);
                    item.refresh();
                }
            }
        } else if (this._group === GroupMode.SEED) {
            // -- Render per seed ---------------------------------------------
            const picturesBySeed: Map<Seed, { picture: PictureEntity, prompt: PromptEntity }[]> = new Map();

            for (const picture of pictures) {
                if (!filter(picture)) {
                    continue;
                }
                const promptId = StaticDataProvider.entitiesHandler.getUpdatedId(picture.promptId);
                if (promptId == null) {
                    // Should never happen since we already filtered pictures
                    continue;
                }
                const prompt = promptsMap[promptId]?.prompt;
                if (prompt == null) {
                    continue;
                }

                const picturesForSeed = picturesBySeed.get(picture.seed) ?? [];
                picturesForSeed.push({ picture, prompt });
                picturesBySeed.set(picture.seed, picturesForSeed);
            }

            const seeds: Seed[] = [...picturesBySeed.keys()];
            seeds.sort((s1, s2) => {
                let res = 0;

                if (res === 0) {
                    const picturesCount1 = picturesBySeed.get(s1)?.length ?? 0;
                    const picturesCount2 = picturesBySeed.get(s2)?.length ?? 0;

                    // Most pictures is better
                    res = -(picturesCount1 - picturesCount2);
                }

                if (res === 0) {
                    res = s1 - s2;
                }

                return res;
            });

            for (const seed of seeds) {
                // -- Add a line break --
                const div = document.createElement("div");
                div.classList.add("w-100");
                this._picturesDiv.appendChild(div);

                const picturesForSeed = picturesBySeed.get(seed);
                if (picturesForSeed == null) {
                    continue;
                }

                // -- Add seed --
                const seedItem = new SeedElement({
                    seed,
                    picturesCount: picturesForSeed.length,
                    isPreferredSeed: preferredSeeds.has(seed)
                });
                seedItem.classList.add("col-12");
                seedItem.refresh();
                this._picturesDiv.appendChild(seedItem);

                // -- Add pictures --

                picturesForSeed.sort((p1, p2) => {
                    let res = 0;

                    if (res === 0) {
                        return p1.picture.seed - p2.picture.seed;
                    }

                    if (res === 0) {
                        return p1.prompt.orderIndex - p2.prompt.orderIndex;
                    }

                    if (res === 0) {
                        return p1.prompt.id - p2.prompt.id;
                    }

                    if (res === 0) {
                        return p1.picture.id - p2.picture.id;
                    }
                    return res;
                });

                for (const { picture, prompt } of picturesForSeed) {
                    const item = this._buildPictureElement(picture, prompt, project);
                    item.classList.add("col-sm-12", "col-md-6", "col-lg-3");
                    this._picturesDiv.appendChild(item);
                    item.refresh();
                }
            }
        } else if (this._group === GroupMode.STARS) {
            // -- Render per seed ---------------------------------------------
            const picturesByScore: Map<Score, { picture: PictureEntity, prompt: PromptEntity }[]> = new Map();

            for (const picture of pictures) {
                if (!filter(picture)) {
                    continue;
                }
                const promptId = StaticDataProvider.entitiesHandler.getUpdatedId(picture.promptId);
                if (promptId == null) {
                    // Should never happen since we already filtered pictures
                    continue;
                }
                const prompt = promptsMap[promptId]?.prompt;
                if (prompt == null) {
                    continue;
                }

                const picturesForScore = picturesByScore.get(picture.score) ?? [];
                picturesForScore.push({ picture, prompt });
                picturesByScore.set(picture.score, picturesForScore);
            }

            const scores: Score[] = [asNamed(4), asNamed(3), asNamed(2), asNamed(1), asNamed(0)];

            for (const score of scores) {
                // -- Add a line break --
                const div = document.createElement("div");
                div.classList.add("w-100");
                this._picturesDiv.appendChild(div);

                const picturesForSeed = picturesByScore.get(score);
                if (picturesForSeed == null) {
                    continue;
                }

                // -- Add seed --
                const scoreItem = new ScoreElement({
                    score,
                    picturesCount: picturesForSeed.length
                });
                scoreItem.classList.add("col-12");
                scoreItem.refresh();
                this._picturesDiv.appendChild(scoreItem);

                // -- Add pictures --
                picturesForSeed.sort((p1, p2) => {
                    let res = 0;

                    if (res === 0) {
                        return -(p1.prompt.orderIndex - p2.prompt.orderIndex);
                    }

                    if (res === 0) {
                        return -(p1.prompt.id - p2.prompt.id);
                    }

                    if (res === 0) {
                        return -(p1.picture.id - p2.picture.id);
                    }
                    return res;
                });

                for (const { picture, prompt } of picturesForSeed) {
                    const item = this._buildPictureElement(picture, prompt, project);
                    item.classList.add("col-sm-12", "col-md-6", "col-lg-3");
                    this._picturesDiv.appendChild(item);
                    item.refresh();
                }
            }
        }

        // -- Auto display prompt panel ---------------------------------------
        if (prompts.length === 0) {
            this._openPromptPanel();
        } else {
            this._closePromptPanel();
        }
    }

    protected _getFilter(preferredSeeds: Set<number>): (picture: PictureEntity) => boolean {
        let filter: (picture: PictureEntity) => boolean = function () { return true };
        const filterIndex = this._picturesFilterSelect.value;
        switch (filterIndex) {
            case "none":
                filter = function () { return false; }
                break;
            case "all":
                filter = function (picture) { return picture.attachmentId != null; }
                break;
            case "preferred":
                filter = function (picture) { return picture.status >= ComputationStatus.DONE && preferredSeeds.has(picture.seed); };
                break;
            case "done":
                filter = function (picture) { return picture.status === ComputationStatus.DONE; };
                break;
            case "accept":
                filter = function (picture) { return picture.status === ComputationStatus.ACCEPTED; };
                break;
            case "reject":
                filter = function (picture) { return picture.status === ComputationStatus.REJECTED; };
                break;
            default:
                console.error(`Invalid value : ${filterIndex}`)
        }
        return filter;
    }

    protected _buildPictureElement(picture: PictureEntity, prompt: PromptEntity, project: ProjectEntity, promptItem?: PromptElement): PictureElement {
        const item = new PictureElement(picture, {
            prompt,
            isPreferredSeed: isPreferredSeed(StaticDataProvider.entitiesHandler, project.id, picture.seed),
            isLockable: project.lockable === true,
            accept: async () => {
                await StaticDataProvider.entitiesHandler.withTransaction(tr => {
                    tr.update("pictures", picture, {
                        status: asNamed(ComputationStatus.ACCEPTED)
                    });
                });
                item.refresh();
                promptItem?.refresh();
                scrollToNextSibling(item);
            },
            reject: async () => {
                await StaticDataProvider.entitiesHandler.withTransaction(tr => {
                    tr.update("pictures", picture, {
                        status: asNamed(ComputationStatus.REJECTED),
                        score: asNamed(0)
                    });
                });
                item.refresh();
                promptItem?.refresh();
                scrollToNextSibling(item);
            },
            toggleSeed: async () => {
                await StaticDataProvider.entitiesHandler.withTransaction(tr => {
                    togglePreferredSeed(StaticDataProvider.entitiesHandler, tr, project.id, picture.seed);
                });
                item._options.isPreferredSeed = isPreferredSeed(StaticDataProvider.entitiesHandler, project.id, picture.seed);
                item.refresh();
            },
            setAsFeatured: async () => {
                await StaticDataProvider.entitiesHandler.withTransaction(tr => {
                    tr.update("projects", project, {
                        featuredAttachmentId: picture.attachmentId
                    });
                });
            },
            setScore: async (score) => {
                await StaticDataProvider.entitiesHandler.withTransaction(tr => {
                    tr.update("pictures", picture, {
                        score
                    });
                });
                item.refresh();
            }
        });
        item.on("clone", (evt) => {
            this._openPromptPanel(evt.data.prompt, evt.data.seed);
        });
        return item;
    }

    protected async _onZipClick(): Promise<void> {
        const projectId = StaticDataProvider.getSelectedProject();
        if (!projectId) {
            return;
        }
        const project = StaticDataProvider.entitiesHandler.getCache("projects").getById(projectId);
        if (!project) {
            return;
        }
        try {
            // Preferred seeds
            const preferredSeeds: Set<number> = new Set(StaticDataProvider.entitiesHandler.getItems("seeds").filter(s => StaticDataProvider.entitiesHandler.isSameId(s.projectId, projectId)).map(s => s.seed));

            const zip = await zipPictures(StaticDataProvider.entitiesHandler, projectId, (attachmentId: AttachmentId) => {
                // -- Download the image --
                const URL = `/attachment/${attachmentId}`;
                return fetch(URL).then(res => res.blob());
            }, this._getFilter(preferredSeeds));
            const blob = await zip.generateAsync({ type: "blob" });
            const a: HTMLAnchorElement = document.createElement("a");
            const url = window.URL.createObjectURL(blob);
            a.href = url;
            a.download = `${project.name.replace("/*", "_")}.zip`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            console.error(e);
        }
    }

    protected async _onQuickClick(): Promise<void> {
        const projectId = StaticDataProvider.getSelectedProject();
        if (!projectId) {
            return;
        }
        APP.setPage(QuickPage);
    }

    protected async _onStarsClick(): Promise<void> {
        const projectId = StaticDataProvider.getSelectedProject();
        if (!projectId) {
            return;
        }
        APP.setPage(StarsPage);
    }

    protected async _onResetStarsClick(): Promise<void> {
        await this._withCurrentProjectPictures(async (tr, pictures) => {
            if (pictures.length === 0) {
                // No pictures to delete
                return;
            }
            const confirmed = await showConfirm({
                title: "Reset stars",
                message: `Reset stars from ${pictures.length} picture(s)`
            });
            if (confirmed === true) {
                for (const picture of pictures) {
                    unstarPicture(StaticDataProvider.entitiesHandler, tr, picture);
                }
            }
        });
        await this.refresh();
    }

    protected async _onClearRejectedButtonClick(): Promise<void> {
        await this._withCurrentProjectPictures(async (tr, pictures) => {
            const picturesToDelete = pictures.filter(picture => picture.status === ComputationStatus.REJECTED || picture.status === ComputationStatus.ERROR);
            if (picturesToDelete.length === 0) {
                return;
            }
            const confirmed = await showConfirm({
                title: "Delete pictures",
                message: `Delete ${picturesToDelete.length} picture(s)`
            });
            if (confirmed === true) {
                for (const picture of picturesToDelete) {
                    deletePicture(StaticDataProvider.entitiesHandler, tr, picture);
                }
            }
        });
        await this.refresh();
    }

    protected _openPromptPanel(prompt?: PromptEntity, seed?: Seed): void {
        // -- Set fields --
        this._promptEditor.setPrompt(prompt, seed);
        // -- Display the panel --
        this._promptCard.classList.remove("d-none");
    }

    protected _closePromptPanel(): void {
        this._promptCard.classList.add("d-none");
    }

    protected async _onNewPromptClick(): Promise<void> {
        try {
            const prompt = this._promptEditor.getPrompt();
            const firstSeed = this._promptEditor.getSeed();
            const projectId = StaticDataProvider.getSelectedProject();
            if (projectId == null) {
                // Should never happen
                return;
            } else {
                let orderIndex: number = 1;
                for (const prompt of StaticDataProvider.entitiesHandler.getItems("prompts")) {
                    if (StaticDataProvider.entitiesHandler.isSameId(prompt.projectId, projectId)) {
                        orderIndex = Math.max(orderIndex, prompt.orderIndex + 1);
                    }
                }
                await StaticDataProvider.entitiesHandler.withTransaction((tr) => {
                    const newPrompt = tr.insert("prompts", {
                        ...prompt,
                        id: asNamed(0),
                        projectId,
                        orderIndex: asNamed(orderIndex)
                    });
                    // Create pictures for 1 seed only, this will allow to test the prompt quickly
                    // even if there are a lot of preferred seeds
                    generateNextPictures(StaticDataProvider.entitiesHandler, tr, newPrompt, 1, firstSeed);
                });
                this._refreshImpl(projectId);
            }
        } catch (e) {
            console.error(e);
        } finally {
            this._promptCard.classList.add("d-none");
        }
    }

    protected _toggleGroupMode(mode: GroupMode): void {
        this._group = mode;
        this.refresh();
    }

    protected async _withCurrentProjectPictures(cb: (tr: SQLTransaction<AppTables, AppContexts>, pictures: PictureEntity[]) => Promise<void> | void): Promise<void> {
        // -- Check that a project is selected --
        const projectId = StaticDataProvider.getSelectedProject();
        if (projectId == null) {
            return;
        }

        // We go from the project id to the prompt ids ...
        const projectPromptIds: Set<number> = new Set();
        for (const prompt of StaticDataProvider.entitiesHandler.getItems("prompts")) {
            if (StaticDataProvider.entitiesHandler.isSameId(prompt.projectId, projectId)) {
                const updatedPromptId = StaticDataProvider.entitiesHandler.getUpdatedId(prompt.id);
                if (updatedPromptId != null) {
                    projectPromptIds.add(updatedPromptId);
                }
            }
        }
        // ... and then we list the pictures in the prompts
        const pictures: PictureEntity[] = [];
        for (const picture of StaticDataProvider.entitiesHandler.getItems("pictures")) {
            const promptId = StaticDataProvider.entitiesHandler.getUpdatedId(picture.promptId);
            if (promptId == null) {
                // Should never happen since we already filtered pictures
                continue;
            }
            if (!projectPromptIds.has(promptId)) {
                continue;
            }
            pictures.push(picture);
        }
        await StaticDataProvider.entitiesHandler.withTransaction(async function (tr) {
            await cb(tr, pictures);
        });
    }
}

customElements.define("pictures-page", PicturesPage);
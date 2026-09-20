import { EventHandler, EventHandlerData, EventHandlerImpl, EventListener } from "@dagda/shared/tools/events";
import { ComfyHostStatus } from "@eurekai/shared/src/comfy.api";
import { ComputationStatus, ProjectEntity, PromptEntity, Seed } from "@eurekai/shared/src/entities";
import { ModelInfo } from "@eurekai/shared/src/models.api";
import { cancelPicture, deletePrompt, generateNextPictures, getPossibleParentPrompts, movePromptToProject, setPromptParent, updateSeeds } from "@eurekai/shared/src/pictures.data";
import { diff_match_patch } from "diff-match-patch";
import { StaticDataProvider } from "src/tools/dataProvider";
import { AbstractDTOElement } from "./abstract.dto.element";
import { formatDuration, showConfirm, showSelect, sortProjects } from "./tools";

const DIFF = new diff_match_patch();

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/** Prompts are long, only the beginning of one is readable in a select */
function shortenPrompt(prompt: string): string {
    const MAX_LENGTH = 80;
    return prompt.length <= MAX_LENGTH ? prompt : `${prompt.substring(0, MAX_LENGTH)}…`;
}

export type PromptEvents = {
    /** Triggered when the user asks for a clone */
    clone: { prompt: PromptEntity, seed?: Seed };
    /** Triggered when prompt needs to be deleted from the current view */
    delete: { prompt: PromptEntity };
}
export class PromptElement extends AbstractDTOElement<PromptEntity> implements EventHandler<PromptEvents> {

    protected model: ModelInfo | null;

    protected errorCount: number = 0;
    protected pendingCount: number = 0;
    protected computingCount: number = 0;
    protected doneCount: number = 0;
    protected acceptedCount: number = 0;
    protected rejectedCount: number = 0;

    protected errorPercent: number = 0;
    protected pendingPercent: number = 0;
    protected computingPercent: number = 0;
    protected donePercent: number = 0;
    protected acceptedPercent: number = 0;
    protected rejectedPercent: number = 0;

    protected promptRemovedCount: number = 0;
    protected promptAddedCount: number = 0;
    protected promptDiff: string = "";
    protected promptDiffShort: string = "";
    protected negativePromptRemovedCount: number = 0;
    protected negativePromptAddedCount: number = 0;
    protected negativePromptDiff: string = "";

    /** Ids of the pictures being computed, filled by refresh() to match the live progress */
    protected _computingPictureIds: Set<number> = new Set();
    /** Last state of the ComfyUI hosts received, kept so it survives a refresh() */
    protected _hosts: ComfyHostStatus[] = [];

    constructor(data: PromptEntity) {
        super(data, require("./prompt.element.html").default);
        this.model = StaticDataProvider.getModelFromCache(data.model);
    }

    //#region Events ----------------------------------------------------------

    protected _eventData: EventHandlerData<PromptEvents> = {};

    public on<EventName extends keyof PromptEvents>(eventName: EventName, listener: EventListener<PromptEvents[EventName]>): void {
        EventHandlerImpl.on(this._eventData, eventName, listener);
    }

    //#endregion

    //#region Live progress ---------------------------------------------------

    /**
     * Set the live state of the ComfyUI hosts, so that the computing part of the progress bar
     * shows how far the generation went instead of a plain block.
     * Only the pictures of this prompt are taken into account, the others are ignored.
     */
    public setLiveProgress(hosts: ComfyHostStatus[]): void {
        this._hosts = hosts;
        this._refreshComputingBar();
    }

    /**
     * Paint the ratio of the pictures already generated on the computing part of the bar.
     *
     * The ratio is the progress of the pictures of this prompt being generated, averaged over the
     * computing ones : a prompt with two pictures in progress, one halfway and one not started
     * yet, fills a quarter of its computing part. The part keeps its full width, so the count of
     * pictures stays where it was and the bar only gains a color boundary.
     */
    protected _refreshComputingBar(): void {
        const bar = this._getElementByRef<HTMLElement>("computingBar");
        if (bar == null) {
            // Nothing is being computed, the template did not render the part
            return;
        }

        // Pictures of this prompt currently generating, whatever the host they run on
        const generating = this._hosts.filter(host => host.pictureId != null && this._computingPictureIds.has(host.pictureId));
        // A node that cannot report a numeric progress (a custom node calling a remote API,
        // typically) leaves the ratio unknown. Keep the plain block in that case rather than
        // painting a bar stuck at 0% for the whole generation.
        const withProgress = generating.filter(host => host.progress != null && host.progress.max > 0);

        if (withProgress.length === 0 || this.computingCount === 0) {
            bar.classList.add("bg-primary");
            bar.style.backgroundColor = "";
            bar.style.backgroundImage = "";
        } else {
            const ratio = withProgress.reduce((sum, host) => sum + host.progress!.value / host.progress!.max, 0) / this.computingCount;
            const percent = Math.round(100 * Math.max(0, Math.min(1, ratio)));
            // The gradient is the only background left : both the bg-primary class (whose color
            // is !important, an inline style cannot win against it) and the default color of a
            // progress bar have to go, or they would fill what is not generated yet with the
            // solid color and hide the ratio.
            bar.classList.remove("bg-primary");
            bar.style.backgroundColor = "transparent";
            bar.style.backgroundImage = `linear-gradient(to right, var(--bs-primary) ${percent}%, rgba(var(--bs-primary-rgb), 0.35) ${percent}%)`;
        }

        // The bar is too small for anything else, the details go in the tooltip
        bar.title = generating.map(describeGeneration).join("\n");
    }

    //#endregion

    public override refresh(): void {
        // -- Prepare variables for the template ------------------------------
        this.errorCount = 0;
        this.pendingCount = 0;
        this.computingCount = 0;
        this.doneCount = 0;
        this.rejectedCount = 0;
        this.acceptedCount = 0;
        this._computingPictureIds.clear();
        for (const picture of StaticDataProvider.entitiesHandler.getItems("pictures")) {
            if (!StaticDataProvider.entitiesHandler.isSameId(picture.promptId, this.data.id)) {
                continue;
            }
            switch (picture.status) {
                case ComputationStatus.ERROR:
                case ComputationStatus.CANCELLED:
                    this.errorCount++;
                    break;
                case ComputationStatus.PENDING:
                    this.pendingCount++;
                    break;
                case ComputationStatus.COMPUTING:
                    this.computingCount++;
                    this._computingPictureIds.add(picture.id);
                    break;
                case ComputationStatus.DONE:
                    this.doneCount++;
                    break;
                case ComputationStatus.ACCEPTED:
                    this.acceptedCount++;
                    break;
                case ComputationStatus.REJECTED:
                    this.rejectedCount++;
                    break;
            }
        }

        const total = this.errorCount + this.pendingCount + this.computingCount + this.rejectedCount + this.doneCount + this.acceptedCount;
        this.errorPercent = this.errorCount / total * 100;
        this.pendingPercent = this.pendingCount / total * 100;
        this.computingPercent = this.computingCount / total * 100;
        this.donePercent = this.doneCount / total * 100;
        this.acceptedPercent = this.acceptedCount / total * 100;
        this.rejectedPercent = this.rejectedCount / total * 100;

        // -- Prepare diff ----------------------------------------------------
        let previousPrompt: PromptEntity | null = null;
        // -- Search for the previous prompt --
        if (this.data.parentId != null) {
            previousPrompt = StaticDataProvider.entitiesHandler.getById("prompts", this.data.parentId) ?? null;
        }

        // -- Compute and prepare diff display --
        this.promptRemovedCount = 0;
        this.promptAddedCount = 0;
        this.promptDiff = escapeHtml(this.data.prompt);
        this.promptDiffShort = escapeHtml(this.data.prompt);
        this.negativePromptRemovedCount = 0;
        this.negativePromptAddedCount = 0;
        this.negativePromptDiff = escapeHtml(this.data.negative_prompt ?? "");
        if (previousPrompt != null) {
            this.promptDiff = "";
            this.promptDiffShort = "";
            const positiveDiff = DIFF.diff_main(previousPrompt.prompt, this.data.prompt);
            DIFF.diff_cleanupSemantic(positiveDiff);
            for (const d of positiveDiff) {
                const escaped = escapeHtml(d[1]);
                if (d[0] < 0) {
                    this.promptRemovedCount++;
                    const t = `<span class="text-danger"><del>${escaped}</del></span>`
                    this.promptDiff += t;
                    this.promptDiffShort += t;
                } else if (d[0] > 0) {
                    this.promptAddedCount++;
                    const t = `<span class="text-success">${escaped}</span>`;
                    this.promptDiff += t;
                    this.promptDiffShort += t;
                } else {
                    this.promptDiff += `<span class="text-muted">${escaped}</span>`;
                    this.promptDiffShort += `...`;
                }
            }

            this.negativePromptDiff = "";
            const negativeDiff = DIFF.diff_main(previousPrompt.negative_prompt ?? "", this.data.negative_prompt ?? "");
            DIFF.diff_cleanupSemantic(negativeDiff);
            for (const d of negativeDiff) {
                const escaped = escapeHtml(d[1]);
                if (d[0] < 0) {
                    this.negativePromptRemovedCount++;
                    this.negativePromptDiff += `<span class="text-danger"><del>${escaped}</del></span>`;
                } else if (d[0] > 0) {
                    this.negativePromptAddedCount++;
                    this.negativePromptDiff += `<span class="text-success">${escaped}</span>`;
                } else {
                    this.negativePromptDiff += `<span class="text-muted">${escaped}</span>`;
                }
            }
        }

        // -- Render the template ---------------------------------------------
        super.refresh();

        // -- Bind buttons ----------------------------------------------------
        // Here we need to bind the buttons once the template has been rendered
        this.querySelectorAll<HTMLButtonElement>("button[data-count]").forEach(countButton => {
            const count = countButton.attributes.getNamedItem("data-count")?.value ?? 1;
            countButton.innerHTML += `+${count}`;
            countButton.addEventListener("click", async () => {
                await StaticDataProvider.entitiesHandler.withTransaction(tr => {
                    generateNextPictures(StaticDataProvider.entitiesHandler, tr, this.data, +count);
                });
                this.refresh();
            });
        });
        this._bindClick("addPreferredButton", async () => {
            await StaticDataProvider.entitiesHandler.withTransaction(tr => {
                generateNextPictures(StaticDataProvider.entitiesHandler, tr, this.data, "preferred");
            });
            this.refresh();
        });
        this._bindClick("clone", () => EventHandlerImpl.fire(this._eventData, "clone", { prompt: this.data }));
        this._bindClick("cancelPending", async () => {
            // Refresh first : the cache may be stale (dirty but not yet re-fetched), and
            // cancelling a picture that was actually generated in the meantime would silently
            // overwrite its DONE status. fetch() only hits the server if the context is dirty.
            await StaticDataProvider.entitiesHandler.fetch({ type: "project", options: { projectId: this.data.projectId } });
            // Only PENDING pictures : a COMPUTING one is already being generated and cannot be stopped
            const picturesToCancel = StaticDataProvider.entitiesHandler.getItems("pictures").filter(picture =>
                StaticDataProvider.entitiesHandler.isSameId(picture.promptId, this.data.id) &&
                picture.status === ComputationStatus.PENDING);
            if (picturesToCancel.length === 0) {
                return;
            }
            const confirmed = await showConfirm({
                title: "Cancel images",
                message: `Cancel ${picturesToCancel.length} image(s) not generated yet`
            });
            if (confirmed === true) {
                await StaticDataProvider.entitiesHandler.withTransaction(tr => {
                    for (const picture of picturesToCancel) {
                        cancelPicture(StaticDataProvider.entitiesHandler, tr, picture);
                    }
                });
            }
            this.refresh();
        });
        this._bindClick("delete", async () => {
            await StaticDataProvider.entitiesHandler.withTransaction((tr) => {
                deletePrompt(StaticDataProvider.entitiesHandler, tr, this.data);
            });
            EventHandlerImpl.fire(this._eventData, "delete", { prompt: this.data });
        });
        const genMoveButtonCallback = (withChildren: boolean) => {
            return async () => {
                const projects = sortProjects(StaticDataProvider.entitiesHandler.getItems("projects"));
                const selectedProject = await showSelect<ProjectEntity>(projects, {
                    valueKey: "id",
                    displayString: "name",
                    selected: projects.find(p => StaticDataProvider.entitiesHandler.isSameId(p.id, this.data.projectId))
                });
                if (selectedProject != null && selectedProject.id != this.data.projectId) {
                    let promptsDeleted: PromptEntity[] = [];
                    await StaticDataProvider.entitiesHandler.withTransaction((tr) => {
                        promptsDeleted = movePromptToProject(StaticDataProvider.entitiesHandler, tr, this.data, selectedProject.id, withChildren);
                    });
                    for (const prompt of promptsDeleted) {
                        EventHandlerImpl.fire(this._eventData, "delete", { prompt });
                    }
                }
            }
        }
        this._bindClick("move", genMoveButtonCallback(false));
        this._bindClick("moveWithChildren", genMoveButtonCallback(true));
        this._bindClick("attachToParent", async () => {
            const candidates = getPossibleParentPrompts(StaticDataProvider.entitiesHandler, this.data);
            if (candidates.length === 0) {
                // No prompt can be a parent here, an empty select would only be confusing
                return;
            }
            candidates.sort((p1, p2) => p1.orderIndex - p2.orderIndex);
            // showSelect displays one property of the items it is given, so the label has to be
            // built beforehand as a property of its own
            const choices = candidates.map(candidate => ({
                id: candidate.id,
                label: `#${candidate.orderIndex} - ${escapeHtml(shortenPrompt(candidate.prompt))}`
            }));
            const selectedChoice = await showSelect(choices, {
                valueKey: "id",
                displayString: "label",
                selected: choices.find(choice => StaticDataProvider.entitiesHandler.isSameId(choice.id, this.data.parentId)),
                title: "Attach to a parent prompt"
            });
            if (selectedChoice == null || StaticDataProvider.entitiesHandler.isSameId(selectedChoice.id, this.data.parentId)) {
                // Cancelled, or same parent as before : nothing to do
                return;
            }
            await StaticDataProvider.entitiesHandler.withTransaction((tr) => {
                setPromptParent(StaticDataProvider.entitiesHandler, tr, this.data, selectedChoice.id);
            });
            // The transaction updated this.data in place, so refreshing displays the diff against
            // the new parent
            this.refresh();
        });
        this._bindClick("detachFromParent", async () => {
            await StaticDataProvider.entitiesHandler.withTransaction((tr) => {
                setPromptParent(StaticDataProvider.entitiesHandler, tr, this.data, null);
            });
            // Same as above : this.data no longer has a parent, the prompt is displayed as a whole
            this.refresh();
        });
        this._bindClick("updateSeeds", async () => {
            return StaticDataProvider.entitiesHandler.withTransaction((tr) => {
                updateSeeds(StaticDataProvider.entitiesHandler, tr, this.data, false);
            });
        });
        this._bindClick("setSeeds", async () => {
            return StaticDataProvider.entitiesHandler.withTransaction((tr) => {
                updateSeeds(StaticDataProvider.entitiesHandler, tr, this.data, true);
            });
        });

        // -- Restore the live progress ---------------------------------------
        // The template has just been rendered from scratch, the ratio painted on the previous
        // bar went away with it
        this._refreshComputingBar();
    }

}

/** One line of the tooltip of the computing part, describing one picture being generated */
function describeGeneration(host: ComfyHostStatus): string {
    const parts: string[] = [`#${host.pictureId}`];
    if (host.progress != null && host.progress.max > 0) {
        parts.push(`${host.progress.value} / ${host.progress.max}`);
    }
    if (host.startedAt != null) {
        parts.push(formatDuration(Date.now() - host.startedAt));
    }
    // Free-form progress of a node calling a remote API (Minimax, ...), the only thing it reports
    if (host.progressText != null) {
        parts.push(host.progressText);
    }
    return parts.join(" · ");
}

customElements.define("custom-prompt", PromptElement);
import { EventHandler, EventHandlerData, EventHandlerImpl, EventListener } from "@dagda/shared/tools/events";
import { ModelInfo } from "@eurekai/shared/src/models.api";
import { generateNextPictures } from "@eurekai/shared/src/pictures.data";
import { ComputationStatus, ProjectDTO, PromptDTO } from "@eurekai/shared/src/types";
import { diff_match_patch } from "diff-match-patch";
import { StaticDataProvider } from "src/tools/dataProvider";
import { AbstractDTOElement } from "./abstract.dto.element";
import { showSelect } from "./tools";

const DIFF = new diff_match_patch();

export type PromptEvents = {
    /** Triggered when the user asks for a clone */
    clone: { prompt: PromptDTO };
    /** Triggered when prompt needs to be deleted from the current view */
    delete: { prompt: PromptDTO };
}
export class PromptElement extends AbstractDTOElement<PromptDTO> implements EventHandler<PromptEvents> {

    protected model: ModelInfo | null;

    protected errorCount: number = 0;
    protected pendingCount: number = 0;
    protected doneCount: number = 0;
    protected acceptedCount: number = 0;
    protected rejectedCount: number = 0;

    protected errorPercent: number = 0;
    protected pendingPercent: number = 0;
    protected donePercent: number = 0;
    protected acceptedPercent: number = 0;
    protected rejectedPercent: number = 0;

    protected promptRemovedCount: number = 0;
    protected promptAddedCount: number = 0;
    protected promptDiff: string = "";
    protected negativePromptRemovedCount: number = 0;
    protected negativePromptAddedCount: number = 0;
    protected negativePromptDiff: string = "";

    constructor(data: PromptDTO) {
        super(data, require("./prompt.element.html").default);
        this.model = StaticDataProvider.getModelFromCache(data.model);
    }

    //#region Events ----------------------------------------------------------

    protected _eventData: EventHandlerData<PromptEvents> = {};

    public on<EventName extends keyof PromptEvents>(eventName: EventName, listener: EventListener<PromptEvents[EventName]>): void {
        EventHandlerImpl.on(this._eventData, eventName, listener);
    }

    //#endregion

    public override refresh(): void {
        // -- Prepare variables for the template ------------------------------
        this.errorCount = 0;
        this.pendingCount = 0;
        this.doneCount = 0;
        this.rejectedCount = 0;
        this.acceptedCount = 0;
        for (const picture of StaticDataProvider.sqlHandler.getItems("pictures")) {
            if (picture.promptId !== this.data.id) {
                continue;
            }
            switch (picture.status) {
                case ComputationStatus.ERROR:
                    this.errorCount++;
                    break;
                case ComputationStatus.PENDING:
                    this.pendingCount++;
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

        const total = this.errorCount + this.pendingCount + this.rejectedCount + this.doneCount + this.acceptedCount;
        this.errorPercent = this.errorCount / total * 100;
        this.pendingPercent = this.pendingCount / total * 100;
        this.donePercent = this.doneCount / total * 100;
        this.acceptedPercent = this.acceptedCount / total * 100;
        this.rejectedPercent = this.rejectedCount / total * 100;

        // -- Prepare diff ----------------------------------------------------
        let previousPrompt: PromptDTO | null = null;
        // -- Search for the previous prompt --
        for (const prompt of StaticDataProvider.sqlHandler.getItems("prompts")) {
            if (prompt.projectId !== this.data.projectId) {
                // Pas le prompt du bon projet
                continue;
            }
            if (prompt.orderIndex >= this.data.orderIndex) {
                // Le prompt est plus récent
                continue;
            }
            if (previousPrompt === null || previousPrompt.orderIndex < prompt.orderIndex) {
                // Pas encore de previous prompt ou alors on a un prompt plus près du prompt courant.
                previousPrompt = prompt;
            }
        }
        // -- Compute and prepare diff display --
        this.promptRemovedCount = 0;
        this.promptAddedCount = 0;
        this.promptDiff = this.data.prompt;
        this.negativePromptRemovedCount = 0;
        this.negativePromptAddedCount = 0;
        this.negativePromptDiff = this.data.prompt;
        if (previousPrompt != null) {
            this.promptDiff = "";
            const positiveDiff = DIFF.diff_main(previousPrompt.prompt, this.data.prompt);
            DIFF.diff_cleanupSemantic(positiveDiff);
            for (const d of positiveDiff) {
                if (d[0] < 0) {
                    this.promptRemovedCount++;
                    this.promptDiff += `<span class="text-danger"><del>${d[1]}</del></span>`;
                } else if (d[0] > 0) {
                    this.promptAddedCount++;
                    this.promptDiff += `<span class="text-success">${d[1]}</span>`;
                } else {
                    this.promptDiff += `<span class="text-muted">${d[1]}</span>`;
                }
            }

            this.negativePromptDiff = "";
            const negativeDiff = DIFF.diff_main(previousPrompt.negative_prompt ?? "", this.data.negative_prompt ?? "");
            DIFF.diff_cleanupSemantic(negativeDiff);
            for (const d of negativeDiff) {
                if (d[0] < 0) {
                    this.negativePromptRemovedCount++;
                    this.negativePromptDiff += `<span class="text-danger"><del>${d[1]}</del></span>`;
                } else if (d[0] > 0) {
                    this.negativePromptAddedCount++;
                    this.negativePromptDiff += `<span class="text-success">${d[1]}</span>`;
                } else {
                    this.negativePromptDiff += `<span class="text-muted">${d[1]}</span>`;
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
                await StaticDataProvider.sqlHandler.withTransaction(tr => {
                    generateNextPictures(StaticDataProvider.sqlHandler, tr, this.data, +count);
                });
                this.refresh();
            });
        });
        this._bindClick("clone", () => EventHandlerImpl.fire(this._eventData, "clone", { prompt: this.data }));
        this._bindClick("delete", async () => {
            await StaticDataProvider.sqlHandler.withTransaction((tr) => {
                for (const picture of StaticDataProvider.sqlHandler.getItems("pictures")) {
                    if (picture.promptId === this.data.id) {
                        tr.delete("pictures", picture.id);
                    }
                }
                tr.delete("prompts", this.data.id);
            });
            EventHandlerImpl.fire(this._eventData, "delete", { prompt: this.data });
        });
        this._bindClick("move", async () => {
            const projects = StaticDataProvider.sqlHandler.getItems("projects");
            const selectedProject = await showSelect<ProjectDTO>(projects, {
                valueKey: "id",
                displayString: "name",
                selected: projects.find(p => p.id === this.data.projectId)
            });
            if (selectedProject != null && selectedProject.id != this.data.projectId) {
                await StaticDataProvider.sqlHandler.withTransaction((tr) => {
                    tr.update("prompts", this.data, { projectId: selectedProject.id });
                });
                EventHandlerImpl.fire(this._eventData, "delete", { prompt: this.data });
            }
        });
    }
}

customElements.define("custom-prompt", PromptElement);
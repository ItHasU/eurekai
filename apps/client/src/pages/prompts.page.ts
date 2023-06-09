import { AbstractPageElement } from "./abstract.page.element";
import { PromptElement } from "src/components/prompt.element";
import { DataCache } from "@eurekai/shared/src/cache";
import { PictureDTO, ProjectDTO } from "@eurekai/shared/src/types";
import { showSelect } from "src/components/tools";

/** Display projects and fire an event on project change */
export class PromptsPage extends AbstractPageElement {

    protected readonly _promptsDiv: HTMLDivElement;
    protected readonly _positiveInput: HTMLInputElement;
    protected readonly _negativeInput: HTMLInputElement;
    protected readonly _bufferSizeInput: HTMLInputElement;
    protected readonly _targetAcceptedInput: HTMLInputElement;

    constructor(cache: DataCache) {
        super(require("./prompts.page.html").default, cache);

        this._promptsDiv = this.querySelector("#promptsDiv") as HTMLDivElement;
        this._positiveInput = this.querySelector("#positiveInput") as HTMLInputElement;
        this._negativeInput = this.querySelector("#negativeInput") as HTMLInputElement;
        this._bufferSizeInput = this.querySelector("#bufferSizeInput") as HTMLInputElement;
        this._targetAcceptedInput = this.querySelector("#targetAcceptedInput") as HTMLInputElement;

        // -- Bind callbacks for buttons --
        this._bindClickForRef("queueButton", this._onQueueClick.bind(this));
    }

    /** @inheritdoc */
    protected override async _refresh(): Promise<void> {
        const prompts = await this._cache.getPrompts();
        const pictures = await this._cache.getPictures();
        const picturesByPrompt: {[promptId: number]: PictureDTO[]} = {};
        for (const picture of pictures) {
            if (picture.promptId != null) {
                if (picturesByPrompt[picture.promptId] == null) {
                    picturesByPrompt[picture.promptId] = [];
                }
                picturesByPrompt[picture.promptId].push(picture);
            }
        }

        // -- Fill prompts --
        this._promptsDiv.innerHTML = "";
        for (const prompt of prompts) {
            const pictures = picturesByPrompt[prompt.id] ?? [];
            // Create the components for each prompt
            const item = new PromptElement(prompt, {
                pictures: pictures,
                start: async () => {
                    await this._cache.withData(async (data) => {
                        await data.setPromptActive(prompt.id, true);
                        prompt.active = true;
                    });
                    item.refresh();
                },
                stop: async () => {
                    await this._cache.withData(async (data) => {
                        await data.setPromptActive(prompt.id, false);
                        prompt.active = false;
                    });
                    item.refresh();
                },
                delete: async () => {
                    await this._cache.withData(async (data) => {
                        await data.movePrompt(prompt.id, null);
                        item.remove();
                    });
                },
                move: async () => {
                    await this._cache.withData(async (data) => {
                        const projects = await data.getProjects();
                        const selectedProject = await showSelect<ProjectDTO>(projects, {
                            valueKey: "id",
                            displayString: "name",
                            selected: projects.find(p => p.id === prompt.projectId)
                        });
                        if (selectedProject != null && selectedProject.id != prompt.projectId) {
                            await data.movePrompt(prompt.id, selectedProject.id);
                            item.remove();
                        }
                    });
                },
                clone: () => {
                    this._positiveInput.value = prompt.prompt;
                    this._negativeInput.value = prompt.negative_prompt ?? "";
                    this._bufferSizeInput.value = "" + prompt.bufferSize;
                    this._targetAcceptedInput.value = "" + prompt.acceptedTarget;
                }
            });
            item.classList.add("col-md-4");
            item.refresh();
            this._promptsDiv.appendChild(item);
        }

        return Promise.resolve();
    }

    /** Add queue button callback */
    protected async _onQueueClick(): Promise<void> {
        const positivePrompt = this._positiveInput.value;
        const negativePrompt = this._negativeInput.value;
        const bufferSize = +this._bufferSizeInput.value;
        const acceptedTarget = +this._targetAcceptedInput.value;
        const projectId = this._cache.getSelectedProjectId();
        if (projectId != null) {
            await this._cache.withData(async (data) => {
                await data.addPrompt({
                    projectId: projectId,
                    prompt: positivePrompt,
                    negative_prompt: negativePrompt,
                    active: true,
                    bufferSize,
                    acceptedTarget
                });
            });
            await this.refresh();
        }
    }



}

customElements.define("prompts-page", PromptsPage);
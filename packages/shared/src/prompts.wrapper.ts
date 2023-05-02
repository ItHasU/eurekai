import { AbstractDatabaseWrapper } from "./abstract.databaseWrapper";
import { PromptDTO } from "./types";

/** Manage prompts in DB */
export class PromptsWrapper extends AbstractDatabaseWrapper<PromptDTO> {

    constructor(dbConstructor: ReturnType<PouchDB.Static["defaults"]>) {
        super(dbConstructor, "prompts");
    }

    /** @returns All active prompts */
    public async getActivePrompts(): Promise<PromptDTO[]> {
        const result = (await this.getAll()).filter(prompt => prompt.active);
        return result;
    }

    /** @returns All prompts sorted by index */
    public override async getAll(): Promise<PromptDTO[]> {
        const prompts = await super.getAll();
        prompts.sort((o1, o2) => o1.index - o2.index);
        return prompts;
    }

    /** Add a prompt to the list */
    public async push(prompt: string, negative_prompt?: string, bufferSize?: number, acceptedTarget?: number): Promise<void> {
        // -- Get next id --
        const prompts = await this.getAll();
        let lastIndex = 0;
        for (const prompt of prompts) {
            lastIndex = Math.max(lastIndex, prompt.index);
        }
        lastIndex++;

        // -- Prepare prompt --
        const dto: PromptDTO = {
            _id: undefined as never,
            _rev: undefined as never,
            index: lastIndex,
            active: true,
            prompt,
            negative_prompt,
            bufferSize: bufferSize ?? 0,
            acceptedTarget: acceptedTarget ?? 0
        };

        // -- Save --
        await this._db.post(dto);
    }

    /** Toggle active flag on all prompts */
    public async toggleAll(active: boolean): Promise<void> {
        const prompts = await this.getAll();
        for (const prompt of prompts) {
            await this.toggle(prompt, active);
        }
    }

    /** Toggle active flag on all prompts */
    public async toggle(prompt: PromptDTO, active: boolean): Promise<void> {
        prompt.active = active;
        await this._update(prompt);
    }
}
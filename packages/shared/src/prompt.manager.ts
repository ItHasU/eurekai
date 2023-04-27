import { PromptDTO } from "./types";

/** Manage prompts in DB */
export class PromptManager {

    protected _db: PouchDB.Database<PromptDTO>;

    constructor(dbConstructor: ReturnType<PouchDB.Static["defaults"]>) {
        this._db = new dbConstructor("prompts");
    }

    public async getActivePrompts(): Promise<PromptDTO[]> {
        const result = await this._db.find({
            selector: {
                "active": { $eq: true }
            },
            sort: ["index"]
        });
        if (result.warning) {
            console.warn(result.warning);
        }
        return result.docs;
    }

    public async getAllPrompts(): Promise<PromptDTO[]> {
        const result = await this._db.allDocs({
            include_docs: true
        });

        const prompts: PromptDTO[] = [];
        for (const row of result.rows) {
            if (row.doc) {
                prompts.push(row.doc);
            }
        }
        prompts.sort((o1, o2) => o1.index - o2.index);
        return prompts;
    }

    public async push(prompt: string, negative_prompt?: string): Promise<void> {
        // -- Get next id --
        const prompts = await this.getAllPrompts();
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
            negative_prompt
        };

        // -- Save --
        await this._db.post(dto);
    }

    /** Remove all prompts */
    public async clean(): Promise<void> {
        const prompts = await this.getAllPrompts();
        for (const prompt of prompts) {
            this._db.remove(prompt);
        }
    }

}
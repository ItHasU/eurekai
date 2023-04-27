import { PictureManager } from "@eurekai/shared/src/picture.manager";
import { PromptManager } from "@eurekai/shared/src/prompt.manager";
import { ComputationStatus, PictureDTO } from "@eurekai/shared/src/types";
import { txt2img } from "./api";

export class GeneratorHandler {

    protected readonly _prompts: PromptManager;
    protected readonly _pictures: PictureManager;


    constructor(dbConstructor: ReturnType<PouchDB.Static["defaults"]>, protected _apiUrl: string) {
        this._prompts = new PromptManager(dbConstructor);
        this._pictures = new PictureManager(dbConstructor);

        this._scheduleNextIfNeeded();
    }

    protected async _unqueue(): Promise<boolean> {
        // -- Get active prompts --
        const prompts = await this._prompts.getActivePrompts();
        if (prompts.length === 0) {
            // Nothing left to generate
            return false;
        }

        // -- Count images per prompt --
        const counts: { [promptId: string]: number } = {};
        const pictures = await this._pictures.getImages();
        for (const picture of pictures) {
            counts[picture.promptId] = (counts[picture.promptId] ?? 0) + 1;
        }

        // -- Get the prompt with the less pictures --
        prompts.sort((p1, p2) => {
            let res: number = 0;

            if (res === 0) {
                const count1 = counts[p1._id] ?? 0;
                const count2 = counts[p2._id] ?? 0;
                res = count1 - count2;
            }

            if (res === 0) {
                res = p1.index - p2.index;
            }

            return res;
        });

        const firstPrompt = prompts[0];
        if (!firstPrompt) {
            return false;
        }

        const picture = await this._pictures.createFromPrompt(firstPrompt);
        const apiUrl = this._apiUrl;
        await this._pictures.run(picture, function (options) {
            return txt2img(apiUrl, options);
        });

        return true;
    }

    protected async _scheduleNextIfNeeded(): Promise<void> {
        return this._unqueue().then((hasGenerated: boolean) => {
            setTimeout(this._scheduleNextIfNeeded.bind(this), hasGenerated ? 0 : 2000);
        });
    }

}
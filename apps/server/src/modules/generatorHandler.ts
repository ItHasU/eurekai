import { PicturesWrapper } from "@eurekai/shared/src/pictures.wrapper";
import { PromptsWrapper } from "@eurekai/shared/src/prompts.wrapper";
import { txt2img } from "./api";

const MAX_IMAGES_PER_PROMPT = 10;

export class GeneratorHandler {

    protected readonly _prompts: PromptsWrapper;
    protected readonly _pictures: PicturesWrapper;

    constructor(dbConstructor: ReturnType<PouchDB.Static["defaults"]>, protected _apiUrl: string) {
        this._prompts = new PromptsWrapper(dbConstructor);
        this._pictures = new PicturesWrapper(dbConstructor);

        this._scheduleNextIfNeeded();
    }

    protected async _unqueue(): Promise<boolean> {
        // -- Get active prompts --
        const prompts = await this._prompts.getActivePrompts();
        if (prompts.length === 0) {
            // Nothing left to generate
            console.debug("No prompts")
            return false;
        }

        // -- Count images per prompt --
        const counts: { [promptId: string]: number } = {};
        const pictures = await this._pictures.getAll();
        for (const picture of pictures) {
            counts[picture.promptId] = (counts[picture.promptId] ?? 0) + 1;
        }
        console.debug(`${prompts.length} active prompt(s)`);
            
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
        const firstPromptCount = counts[firstPrompt._id] ?? 0;
        console.debug(`${firstPromptCount} image(s) existing for the prompt`)
        if (firstPromptCount >= MAX_IMAGES_PER_PROMPT) {
            // Already enough images
            return false;
        }

        const picture = await this._pictures.createFromPrompt(firstPrompt);
        const apiUrl = this._apiUrl;
        await this._pictures.run(picture, async function (options) {
            console.debug(`Requesting a new image on ${apiUrl}...`);
            const images = await txt2img(apiUrl, options);
            console.debug(`${images.length} image(s) received`);
            return images;
        });

        return true;
    }

    protected async _scheduleNextIfNeeded(): Promise<void> {
        return this._unqueue().then((hasGenerated: boolean) => {
            setTimeout(this._scheduleNextIfNeeded.bind(this), hasGenerated ? 0 : 2000);
        });
    }

}
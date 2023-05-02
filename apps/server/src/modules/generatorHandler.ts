import { PicturesWrapper } from "@eurekai/shared/src/pictures.wrapper";
import { PromptsWrapper } from "@eurekai/shared/src/prompts.wrapper";
import { txt2img } from "./api";
import { ComputationStatus } from "@eurekai/shared/src/types";

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
            console.debug("No active prompt")
            return false;
        }
        console.debug(`${prompts.length} active prompt(s)`);

        // -- Count images per prompt --
        const countsPending: { [promptId: string]: number } = {};
        const countsAccepted: { [promptId: string]: number } = {};
        const pictures = await this._pictures.getAll();
        console.log(`${pictures.length} picture(s) already existing`);
        for (const picture of pictures) {
            if (picture.computed <= ComputationStatus.DONE) {
                // Count pictures pending or waiting for evaluation
                countsPending[picture.promptId] = (countsPending[picture.promptId] ?? 0) + 1;
            } else if (picture.computed === ComputationStatus.ACCEPTED) {
                countsAccepted[picture.promptId] = (countsAccepted[picture.promptId] ?? 0) + 1;
            } else {
                // Don't count other images
            }
        }
        console.debug(countsPending);
        console.debug(countsAccepted);

        // -- Get the prompt with the less pictures --
        prompts.sort((p1, p2) => {
            let res: number = 0;

            if (res === 0) {
                const count1 = countsPending[p1._id] ?? 0;
                const count2 = countsPending[p2._id] ?? 0;
                res = count1 - count2;
            }

            if (res === 0) {
                const count1 = countsAccepted[p1._id] ?? 0;
                const count2 = countsAccepted[p2._id] ?? 0;
                res = count1 - count2;
            }

            if (res === 0) {
                res = p1.index - p2.index;
            }

            return res;
        });

        let firstPrompt = null;
        for (const prompt of prompts) {
            const accepted = countsAccepted[prompt._id] ?? 0;
            const pending = countsPending[prompt._id] ?? 0;
            if (prompt.acceptedTarget > 0 && prompt.acceptedTarget <= accepted) {
                // We have enough accepted images
                continue;
            }
            if (prompt.bufferSize > 0 && prompt.bufferSize <= pending) {
                // We have filled the buffer of images to evaluate
                continue;
            }

            firstPrompt = prompt;
            break;
        }
        if (!firstPrompt) {
            console.log("No active prompt pending");
            return false;
        } else {
            console.log(`Selected #${firstPrompt.index}, ${countsPending[firstPrompt._id] ?? "--"}/${firstPrompt.bufferSize} pending, ${countsAccepted[firstPrompt._id] ?? "--"}/${firstPrompt.acceptedTarget} accepted`);
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
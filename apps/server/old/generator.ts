import { ComputationStatus } from "@eurekai/shared/src/types";
import { DatabaseWrapper } from "./db";
import { NotificationKind } from "@eurekai/shared/src/data";

export class Generator {
    protected _stopOnNextTimeout: boolean = false;

    constructor(protected readonly _data: DatabaseWrapper) {
        this._scheduleNextIfNeeded();
    }

    public stop(): void {
        this._stopOnNextTimeout = true;
    }

    protected async _unqueue(): Promise<boolean> {
        // -- Get active prompts --
        const prompts = await this._data.getPendingPrompts();
        if (prompts.length !== 0) {
            console.debug(`${prompts.length} active prompt(s)`);

            // -- Get the prompt with the less pictures --
            let firstPrompt = prompts[0];
            if (firstPrompt) {
                console.log(`Selected #${firstPrompt.orderIndex}, ${firstPrompt.pendingPictureCount}/${firstPrompt.bufferSize} pending`);

                // -- Check if there is a preferred seed pending --
                const preferredSeed = await this._data.getSeedPending(firstPrompt.id);
                const picture = await this._data.createPictureFromPrompt(firstPrompt, preferredSeed ?? undefined);
                try {
                    const image = await this._data.getSelectedDiffuser().txt2img({
                        prompt: firstPrompt.prompt,
                        negative_prompt: firstPrompt.negative_prompt,
                        width: firstPrompt.width,
                        height: firstPrompt.height,
                        seed: picture.seed
                    }, false);
                    console.debug(`Lowres image received`);
                    await this._data.setPictureData(picture.id, image);
                    this._data.pushNotification({
                        kind: NotificationKind.IMAGE_NEW,
                        projectId: firstPrompt.projectId,
                        message: `New image for #${firstPrompt.orderIndex}`
                    });
                } catch (err) {
                    console.error(err);
                    await this._data.setPictureStatus(picture.id, ComputationStatus.ERROR);
                }
                return true;
            }
        }

        // -- Get pending highres pictures --
        const highresPictures = await this._data.getPicturesHighresPending();
        if (highresPictures.length > 0) {
            console.debug(`${highresPictures.length} highres picture(s) pending`);
            const picture = highresPictures[0];
            const prompt = await this._data.getPrompt(picture.promptId);
            console.debug(`Requesting a new highres image...`);
            try {
                await this._data.setPictureHighresStatus(picture.id, ComputationStatus.COMPUTING);
                const image = await this._data.getSelectedDiffuser().txt2img({
                    prompt: prompt.prompt,
                    negative_prompt: prompt.negative_prompt,
                    width: prompt.width,
                    height: prompt.height,
                    seed: picture.seed
                }, true);
                console.debug(`Highres image received`);
                await this._data.setPictureHighresData(picture.id, image);
                this._data.pushNotification({
                    kind: NotificationKind.IMAGE_NEW_HIGHRES,
                    projectId: prompt.projectId,
                    message: `New highres image`
                });
                return true;
            } catch (err) {
                console.error(err);
                await this._data.setPictureHighresStatus(picture.id, ComputationStatus.ERROR);
            }
            return true;
        }

        // -- Nothing was generated --
        console.debug("Nothing to generate");
        return false;
    }

    protected async _scheduleNextIfNeeded(): Promise<void> {
        return this._unqueue().then((hasGenerated: boolean) => {
            if (this._stopOnNextTimeout) {
                return;
            } else {
                setTimeout(this._scheduleNextIfNeeded.bind(this), hasGenerated ? 0 : 2000);
            }
        });
    }

}
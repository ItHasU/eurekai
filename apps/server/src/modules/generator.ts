import { ComputationStatus, HighresStatus } from "@eurekai/shared/src/types";
import { txt2img } from "./api";
import { DatabaseWrapper } from "./db";

export class Generator {

    protected _stopOnNextTimeout: boolean = false;

    constructor(protected readonly _data: DatabaseWrapper, protected _apiUrl: string) {
        this._scheduleNextIfNeeded();
    }

    public stop(): void {
        this._stopOnNextTimeout = true;
    }

    protected async _unqueue(): Promise<boolean> {
        // -- Get pending highres pictures --
        const highresPictures = await this._data.getPicturesHighresPending();
        if (highresPictures.length > 0) {
            console.debug(`${highresPictures.length} highres picture(s) pending`);
            const picture = highresPictures[0];
            const project = await this._data.getProject(picture.projectId);
            if (project != null) {
                const apiUrl = this._apiUrl;
                console.debug(`Requesting a new highres image on ${apiUrl}...`);
                try {
                    await this._data.setPictureHighresStatus(picture.id, HighresStatus.COMPUTING);
                    const images = await txt2img(apiUrl, {
                        ...picture.options,
                        enable_hr: true,
                        hr_scale: project.scale
                    });
                    console.debug(`${images.length} image(s) received`);
                    if (images.length > 0) {
                        await this._data.setPictureHighresData(picture.id, images[0]);
                    }
                    return true;
                } catch (err) {
                    await this._data.setPictureHighresStatus(picture.id, HighresStatus.ERROR);
                    console.error(err);
                }
            } else {
                // Make sure we won't try again
                await this._data.setPictureHighresStatus(picture.id, HighresStatus.ERROR);
            }
        }
        // -- Get active prompts --
        const prompts = await this._data.getPendingPrompts();
        if (prompts.length === 0) {
            // Nothing left to generate
            console.debug("No active prompt")
            return false;
        }
        console.debug(`${prompts.length} active prompt(s)`);

        // -- Get the prompt with the less pictures --
        let firstPrompt = prompts[0];
        if (!firstPrompt) {
            console.log("No active prompt pending");
            return false;
        } else {

            console.log(`Selected #${firstPrompt.orderIndex}, ${firstPrompt.pendingPictureCount}/${firstPrompt.bufferSize} pending, ${firstPrompt.acceptedPictureCount}/${firstPrompt.acceptedTarget} accepted`);

            // -- Check if there is a preferred seed pending --
            const preferredSeed = await this._data.getSeedPending(firstPrompt.id);

            const picture = await this._data.createPictureFromPrompt(firstPrompt, preferredSeed ?? undefined);
            const apiUrl = this._apiUrl;
            console.debug(`Requesting a new image on ${apiUrl}...`);
            try {
                const images = await txt2img(apiUrl, picture.options);
                console.debug(`${images.length} image(s) received`);
                if (images.length > 0) {
                    await this._data.setPictureData(picture.id, images[0]);
                }
            } catch (err) {
                console.error(err);
                await this._data.setPictureStatus(picture.id, ComputationStatus.ERROR);
            }
            return true;
        }
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
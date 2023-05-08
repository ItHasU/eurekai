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

            const picture = await this._data.createPictureFromPrompt({ prompt: firstPrompt });
            const apiUrl = this._apiUrl;
            console.debug(`Requesting a new image on ${apiUrl}...`);
            const images = await txt2img(apiUrl, picture.options);
            console.debug(`${images.length} image(s) received`);
            if (images.length > 0) {
                this._data.setPictureData(picture.id, images[0]);
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
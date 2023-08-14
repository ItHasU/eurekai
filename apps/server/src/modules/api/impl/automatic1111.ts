import { Txt2ImgOptions } from "@eurekai/shared/src/types";
import { AbstractAPI } from "../abstract.api";
import { SDModels } from "@eurekai/shared/src/data";

declare var fetch: typeof import('undici').fetch; // Package undici is only required for typing not for runtime

export class Automatic1111 extends AbstractAPI {
    constructor(protected readonly apiURL: string) {
        super();
    }

    //#region Models management

    /** @inheritdoc */
    public override async getModels(): Promise<SDModels[]> {
        const url = `${this.apiURL}/sdapi/v1/sd-models`;
        const result = await fetch(url);
        if (result.status !== 200) {
            throw new Error(result.statusText);
        } else {
            return await result.json() as SDModels[];
        }
    }

    /** @inheritdoc */
    public override async getSelectedModel(): Promise<string | null> {
        const url = `${this.apiURL}/sdapi/v1/options`;
        const result = await fetch(url);
        if (result.status !== 200) {
            throw new Error(result.statusText);
        } else {
            const data: Record<string, any> = await result.json() as Record<string, any>;
            return data["sd_model_checkpoint"] ?? null;
        }
    }

    /** @inheritdoc */
    public override async setSelectedModel(model: string): Promise<void> {
        const url = `${this.apiURL}/sdapi/v1/options`;
        const result = await fetch(url, {
            method: 'POST',
            body: JSON.stringify({
                "sd_model_checkpoint": model
            }),
            headers: {
                'Content-Type': 'application/json',
            }
        });
        if (result.status !== 200) {
            throw new Error(result.statusText);
        }
    }

    //#endregion


    //#region Image generation

    /** @inheritdoc */
    public override async txt2img(options: Txt2ImgOptions): Promise<string[]> {
        const url = `${this.apiURL}/sdapi/v1/txt2img`;
        const result = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(options),
            headers: {
                'Content-Type': 'application/json',
            }
        });
        if (result.status !== 200) {
            throw new Error(result.statusText);
        } else {
            const data = await result.json() as { images: string[] };
            if (!data.images) {
                throw new Error('api returned an invalid response');
            }
            return data.images;
        }
    }

    //#endregion
}
import { Txt2ImgOptions } from "@eurekai/shared/src/types";
import { SDModels } from "@eurekai/shared/src/data";

declare var fetch: typeof import('undici').fetch; // Package undici is only required for typing not for runtime

export async function txt2img(apiUrl: string, options: Txt2ImgOptions): Promise<string[]> {
    const url = `${apiUrl}/sdapi/v1/txt2img`;
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

export async function getModels(apiUrl: string): Promise<SDModels[]> {
    const url = `${apiUrl}/sdapi/v1/sd-models`;
    const result = await fetch(url);
    if (result.status !== 200) {
        throw new Error(result.statusText);
    } else {
        return await result.json() as SDModels[];
    }
}


export async function getModel(apiUrl: string): Promise<string | null> {
    const url = `${apiUrl}/sdapi/v1/options`;
    const result = await fetch(url);
    if (result.status !== 200) {
        throw new Error(result.statusText);
    } else {
        const data: Record<string, any> = await result.json() as Record<string, any>;
        return data["sd_model_checkpoint"] ?? null;
    }
}

export async function setModel(apiUrl: string, model: string): Promise<void> {
    const url = `${apiUrl}/sdapi/v1/options`;
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
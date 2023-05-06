import { Txt2ImgOptions } from "@eurekai/shared/src/types";
declare var fetch: typeof import('undici').fetch; // Package undici is only required for typing not for runtime

export async function txt2img(apiUrl: string, options: Txt2ImgOptions): Promise<string[]> {
    const url = `${apiUrl}/sdapi/v1/txt2img`;
    console.log("Trying to contact: " + url);
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
        console.log(data);
        if (!data.images) {
            throw new Error('api returned an invalid response');
        }
        return data.images;
    }
}

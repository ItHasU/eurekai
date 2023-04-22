import { Txt2ImgOptions } from "eurekai-commons/src/types";

export async function txt2img(apiUrl: string, options: Txt2ImgOptions) {
    const result = await fetch(`${apiUrl}/sdapi/v1/txt2img`, {
        method: 'POST',
        body: JSON.stringify(options),
        headers: {
            'Content-Type': 'application/json',
        },
    });
    if (result.status !== 200) {
        throw new Error(result.statusText);
    } else {
        const data = await result.json();
        if (!data?.images) {
            throw new Error('api returned an invalid response');
        }
        return data;
    }
}

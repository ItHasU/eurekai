export type SamplingMethod = "Euler a" | "Euler" | "LMS" | "Heun" | "DPM2" | "DPM2 a" | "DPM++ S2 a" | "DPM++ 2M" | "DPM++ SDE" | "DPM fast" | "DPM adaptive" | "LMS Karras" | "DPM2 Karras" | "DPM2 a Karras" | "DPM++ 2S a Karras" | "DPM++ 2M Karras" | "DPM++ SDE Karras" | "DDIM" | "PLMS";



export interface Txt2ImgOptions {
    prompt: string;
    negative_prompt?: string;
    seed: number;
    sampler_name: SamplingMethod;
    steps: number;
    width: number;
    height: number;

    batch_size: number;
    n_iter: number;

    cfg_scale: number;
}


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
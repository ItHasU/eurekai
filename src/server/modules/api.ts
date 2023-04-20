import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Txt2ImgOptions } from "../../commons/types";

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

async function queue(apiUrl: string, output_folder: string, options: {
    prompts: { positive: string, negative?: string }[],
    seeds: number[]
}): Promise<void> {
    const inputs: Txt2ImgOptions[] = [];
    const default_parameters: Txt2ImgOptions = {
        prompt: "",
        negative_prompt: "",
        seed: -1,

        width: 512,
        height: 512,
        steps: 20,
        sampler_name: "DPM++ 2M",

        n_iter: 1,
        batch_size: 1,
        cfg_scale: 7,
    };

    for (const prompt of options.prompts) {
        for (const seed of options.seeds) {
            inputs.push({
                ...default_parameters,
                prompt: prompt.positive,
                negative_prompt: prompt.negative,
                seed,
            });
        }
    }

    let i = 0;
    const result = inputs.map((options => {
        return txt2img(apiUrl, options).then((data) => {
            writeFileSync(join(output_folder, `images-${i++}.png`), data.images[0], "base64");
        });
    }));
    await Promise.all(result).then(() => { });
}

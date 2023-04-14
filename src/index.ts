import { writeFileSync } from "node:fs";
import { txt2img } from "./api";

async function main() {
    const apiUrl = "http://192.168.42.20:7860";

    try {
        const { images } = await txt2img(apiUrl, {
            prompt: 'A meteorite falling on earth',
            negative_prompt: 'bad anatomy',
            sampler_name: "DPM++ 2M",
            width: 512,
            height: 512,
            steps: 20,
            batch_size: 1,
            n_iter: 1,
            cfg_scale: 7,
            seed: 46012
        });

        images.forEach((image, i) =>
            writeFileSync(`image-${i}.png`, images[i], 'base64')
        )
    } catch (err) {
        console.error(err)
    }
}

main().catch(e => console.error(e));


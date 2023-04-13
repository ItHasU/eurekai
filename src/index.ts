import { writeFileSync } from "fs";
import sdwebui, { Client, SamplingMethod } from "node-sd-webui";

async function main() {
    // try {
    //     const result = await fetch(`http://127.0.0.1:7860/sdapi/v1/sd-models`, {
    //         method: 'GET',
    //         headers: {
    //             'Content-Type': 'application/json',
    //         },
    //     })
    //     console.log(result);
    // } catch (e) {
    //     console.error(e);
    // }

    const client: Client = sdwebui({ apiUrl: "http://127.0.0.1:7860" });
    try {
        const { images } = await client.txt2img({
            prompt: 'A photo of a mushroom, red cap, white spots',
            negativePrompt: 'blurry, cartoon, drawing, illustration',
            samplingMethod: SamplingMethod.Euler_A,
            width: 640,
            height: 360,
            steps: 20,
            batchSize: 1,
            batchCount: 1,
            save_images: true
        });

        images.forEach((image, i) =>
            writeFileSync(`image-${i}.png`, images[i], 'base64')
        )
    } catch (err) {
        console.error(err)
    }
}

main().catch(e => console.error(e));


import { queue } from "./api";

async function main() {
    const apiUrl = "http://192.168.42.20:7860";

    try {
        await queue(apiUrl, "./images/", {
            prompts: [
                { positive: "A meteorite falling on the earth", negative: "human" },
                { positive: "A meteorite falling on a planet" },
                { positive: "A meteorite falling on a planet, wide angle view" }
            ],
            seeds: [46012, 123456, 6546435435]
        });
    } catch (err) {
        console.error(err)
    }
}

main().catch(e => console.error(e));


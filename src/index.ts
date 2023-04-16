import { queue } from "./api";
import { DBConnector } from "./pouch_connector";

// async function main() {
//     const apiUrl = "http://192.168.42.20:7860";

//     try {
//         await queue(apiUrl, "./images/", {
//             prompts: [
//                 { positive: "A meteorite falling on the earth", negative: "human" },
//                 { positive: "A meteorite falling on a planet" },
//                 { positive: "A meteorite falling on a planet, wide angle view" }
//             ],
//             seeds: [46012, 123456, 6546435435]
//         });
//     } catch (err) {
//         console.error(err)
//     }
// }

async function main(): Promise<void> {
    const connector = new DBConnector();
    await connector._scheduleNextIfNeeded();
    await connector.queue([
        { positive: "A meteorite falling on the earth", negative: "human" },
        { positive: "A meteorite falling on a planet" },
        { positive: "A meteorite falling on a planet, wide angle view" }
    ], [46012, 123456, 6546435435]);
}

main().catch(e => console.error(e));


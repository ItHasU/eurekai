import { DBConnector } from "./pouch_connector";

const apiUrl = "http://192.168.42.20:7860";
// const apiUrl = "http://localhost:7860";

async function main(): Promise<void> {
    const connector = new ServerDBConnector(apiUrl);
    // await connector.queue([
    //     { positive: "A meteorite falling on the earth", negative: "human" },
    //     { positive: "A meteorite falling on a planet" },
    //     { positive: "A meteorite falling on a planet, wide angle view" }
    // ], [46012, 123456, 6546435435]);

    let remaining: number = 0;
    console.log("Starting computation ...")
    do {
        remaining = await connector.unqueue();
        console.log(`${remaining} image(s) remaining`);
    } while (remaining > 0);
    console.log("Done");

    console.log("Writing ...");
    await connector.writeAll();
}

main().catch(e => console.error(e));

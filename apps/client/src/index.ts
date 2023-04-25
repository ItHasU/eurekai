import { ClientDBConnector } from "./clientDB";

const db: ClientDBConnector = new ClientDBConnector();

async function main(): Promise<void> {
  console.log("Starting db ...")
  await db.queue([
    { positive: "a fire ball" }
  ], [
    -1
  ]);
  const pictures = await db.getImages();
  console.log(pictures);

  db.refreshImages();
}

main().catch(e => console.error(e));
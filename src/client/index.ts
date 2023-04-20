import { DBConnector } from "../commons/db";
import { ClientDBConnector } from "./clientDB";

const db: DBConnector = new ClientDBConnector();

async function main(): Promise<void> {
  await db.queue([
    { positive: "a snow ball" }
  ], [
    -1
  ]);
}

main().catch(e => console.error(e));

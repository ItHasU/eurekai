import PouchDB from "pouchdb";
import { ClientDBConnector } from "./clientDB";

const db: ClientDBConnector = new ClientDBConnector();

async function main(): Promise<void> {
  await db.queue([
    { positive: "a snow ball" }
  ], [
    -1
  ]);
}

main().catch(e => console.error(e));
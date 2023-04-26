import { PromptManager } from "@eurekai/shared/src/prompt.manager";
import PouchDB from "pouchdb";

export class ClientPromptManager extends PromptManager {

    public readonly replication: PouchDB.Replication.Sync<{}>;

    constructor() {
        super(PouchDB);
        this.replication = this._db.sync('http://localhost:3000/db/prompts', {
            live: true,
            retry: true,
            since: 0
        });
    }

}
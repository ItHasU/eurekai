import { DBConnector } from "@eurekai/commons/src/db";

export class ClientDBConnector extends DBConnector {
    constructor() {
        super();
        this._db.replicate.from("/db");
        this._db.replicate.to("/db");
    }
}
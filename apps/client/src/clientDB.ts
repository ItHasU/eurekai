import { DBConnector } from "@eurekai/shared/src/db";

export class ClientDBConnector extends DBConnector {
    constructor() {
        super();
        this._db.replicate.from("/db");
        this._db.replicate.to("/db");
    }
}
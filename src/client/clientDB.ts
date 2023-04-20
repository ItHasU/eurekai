import { DBConnector } from "../commons/db";

export class ClientDBConnector extends DBConnector {
    constructor() {
        super();
        this._db.replicate.from("/db");
        this._db.replicate.to("/db");
    }
}
import { DBConnector } from "@eurekai/shared/src/db";
import { ComputationStatus } from "@eurekai/shared/src/types";
import PouchDB from "pouchdb";

export class ClientDBConnector extends DBConnector {
    public readonly replication: PouchDB.Replication.Sync<{}>;

    constructor() {
        super(PouchDB);
        this.replication = this._db.sync('http://localhost:3000/db/pictures', {
            live: true,
            retry: true,
            since: 0
        });
        // .on('change', (info) => {
        //     // handle change
        //     console.log("change", info);
        // }).on('paused', function (err) {
        //     // replication paused (e.g. replication up to date, user went offline)
        //     console.log("paused", err);
        // }).on('active', function () {
        //     // replicate resumed (e.g. new changes replicating, user went back online)
        //     console.log("active")
        // }).on('denied', function (err) {
        //     // a document failed to replicate (e.g. due to permissions)
        //     console.log("denied")
        // }).on('complete', function (info) {
        //     // handle complete
        //     console.log("complete", info)
        // }).on('error', function (err) {
        //     // handle error
        //     console.log("error", err)
        // });
    }
}
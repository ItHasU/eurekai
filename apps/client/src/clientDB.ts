import { DBConnector } from "@eurekai/shared/src/db";
import { ComputationStatus } from "@eurekai/shared/src/types";
import PouchDB from "pouchdb";

export class ClientDBConnector extends DBConnector {
    constructor() {
        super(PouchDB);
        var rep = this._db.sync('http://localhost:3000/db/pictures', {
            live: true,
            retry: true,
            since: 0
        }).on('change', (info) => {
            // handle change
            console.log("change", info);
            this.refreshImages();
        }).on('paused', function (err) {
            // replication paused (e.g. replication up to date, user went offline)
            console.log("paused", err);
        }).on('active', function () {
            // replicate resumed (e.g. new changes replicating, user went back online)
            console.log("active")
        }).on('denied', function (err) {
            // a document failed to replicate (e.g. due to permissions)
            console.log("denied")
        }).on('complete', function (info) {
            // handle complete
            console.log("complete", info)
        }).on('error', function (err) {
            // handle error
            console.log("error", err)
        });
    }

    public async refreshImages(): Promise<void> {
        document.body.innerHTML = "";

        let content: string = "";
        const images = await this.getImages();
        for (const image of images) {
            content += JSON.stringify(image.options) + "<br>";
            if (image.computed === ComputationStatus.DONE) {
                for( const attachmentId in image._attachments) {
                    const attachment = image._attachments[attachmentId];
                    content += `<img src="data:image/png;base64, ${attachment.data}" alt-"${attachmentId}"><br>`;
                }
            }
        }
        document.body.innerHTML = content;
    }
}
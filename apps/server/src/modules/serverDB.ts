import { txt2img } from "./api";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ComputationStatus, PictureDTO } from "@eurekai/shared/src/types";
import { DBConnector } from "@eurekai/shared/src/db";

export class ServerDBConnector extends DBConnector {
    protected _scheduled: Promise<void> | null = null;

    constructor(protected _apiUrl: string) {
        super();
        this._scheduleNextIfNeeded();
    }

    /** @returns The number of images pending */
    public async unqueue(): Promise<number> {
        // -- Get pending pictures --
        const pictures = await this._db.allDocs({
            include_docs: true,
            attachments: false
        });

        const pendingPictures: PictureDTO[] = [];
        for (const picture of pictures.rows) {
            if (!picture.doc) {
                continue;
            }
            if (picture.doc.computed != ComputationStatus.PENDING) {
                continue;
            }

            pendingPictures.push(picture.doc);
        }
        // -- Check that there is a picture --
        if (pendingPictures.length == 0) {
            // We are done
            return -1;
        }

        // -- Sort pictures by priority --
        // TODO

        // -- Generate a new image --
        const doc = pendingPictures[0];
        console.log(`Generating ${doc._id}`);
        await this._run(doc);

        // -- Done --
        return pendingPictures.length - 1;
    }

    public async writeAll(): Promise<void> {
        // -- Get pending pictures --
        const pictures = await this._db.allDocs({
            include_docs: true,
            attachments: true
        });

        for (const picture of pictures.rows) {
            if (!picture.doc) {
                continue;
            }
            for (const attachmentKey in picture.doc._attachments) {
                const data = picture.doc._attachments[attachmentKey];
                const filename = picture.doc._id + attachmentKey;
                console.log(filename);
                writeFileSync(join("./images/", filename), data.data, "base64");
            }
        }
    }

    public async _scheduleNextIfNeeded(): Promise<void> {
        console.log("Waiting for new images to generate");
        return this.unqueue().then((remaining: number) => {
            console.log(`${remaining} image(s) to generate`);
            if (remaining < 0) {
                this._db.changes({
                    live: false // Only once
                }).addListener("changes", this._scheduleNextIfNeeded.bind(this));
            } else {
                setTimeout(this._scheduleNextIfNeeded.bind(this), 0);
            }
        });
    }

    /**
     * Compute the image and save it to the database
     */
    protected async _run(doc: PictureDTO): Promise<void> {
        // -- Change status --
        doc.computed = ComputationStatus.COMPUTING;
        await this._update(doc);

        // -- Compute --
        try {
            // Start computation
            const result = await txt2img(this._apiUrl, doc.options);
            // Save results as attachments
            doc.computed = ComputationStatus.DONE;
            for (let i = 0; i < result.images.length; i++) {
                doc._attachments[`${i}.png`] = {
                    content_type: "image/png",
                    data: result.images[i],
                };
            }
            await this._update(doc);
        } catch (e) {
            console.error(e);
            doc.computed = ComputationStatus.ERROR;
            await this._update(doc);
        }
    }

    public async test(): Promise<void> {
        await this.queue([
            { positive: "A", negative: "N" },
            { positive: "B", negative: "M" }
        ], [1, 2]);

        const docs = await this._db.allDocs({
            include_docs: true
        });

        for (const doc of docs.rows) {
            if (!doc.doc) {
                console.log("No doc");
            } else {
                console.log("----------------------");
                console.log(JSON.stringify(doc.doc));
                doc.doc.computed = ComputationStatus.ERROR;
                await this._update(doc.doc);
                console.log(JSON.stringify(doc.doc));
            }
        }
    }
}

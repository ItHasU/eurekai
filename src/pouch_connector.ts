import * as PouchDB from "pouchdb";
import { Txt2ImgOptions } from "./api";
import { txt2img } from "./api";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

export enum ComputationStatus {
    PENDING = 1,
    COMPUTING,
    DONE,
    ERROR,

    ACCEPTED,
    REJECTED
}

export interface PictureDTO extends PouchDB.Core.IdMeta, PouchDB.Core.RevisionIdMeta {
    /** Options that were used to generate the picture */
    options: Txt2ImgOptions;
    /** Is picture computed */
    computed: ComputationStatus;
    /** Attachments as Base64 */
    _attachments: {
        [filename: string]: {
            "content_type": "image/png",
            "data": string
        }
    }
}

export class DBConnector {
    protected _db: PouchDB.Database<PictureDTO>;
    protected _scheduled: Promise<void> | null = null;

    constructor(protected _apiUrl: string) {
        this._db = new PouchDB("pictures");
        this._scheduleNextIfNeeded();
    }

    /** Queue images */
    public async queue(
        prompts: { positive: string, negative?: string }[],
        seeds: number[]): Promise<void> {
        const inputs: Txt2ImgOptions[] = [];
        const default_parameters: Txt2ImgOptions = {
            prompt: "",
            negative_prompt: "",
            seed: -1,

            width: 512,
            height: 512,
            steps: 20,
            sampler_name: "DPM++ 2M",

            n_iter: 1,
            batch_size: 1,
            cfg_scale: 7,
        };

        for (const prompt of prompts) {
            for (const seed of seeds) {
                this.generate({
                    ...default_parameters,
                    prompt: prompt.positive,
                    negative_prompt: prompt.negative,
                    seed
                });
            }
        }
    }

    public async generate(options: Txt2ImgOptions): Promise<PictureDTO> {
        const picture: PictureDTO = {
            _id: undefined,
            _rev: undefined,
            computed: ComputationStatus.PENDING,
            options,
            _attachments: {}
        };
        const response = await this._db.post(picture as PictureDTO);
        if (response.ok) {
            picture._id = response.id;
            picture._rev = response.rev;
            return picture;
        } else {
            throw "Failed to save picture";
        }
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
            return 0;
        }

        // -- Sort pictures by priority --
        // TODO

        // -- Generate a new image --
        const doc = pendingPictures[0];
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

    protected async _update(doc: PictureDTO): Promise<void> {
        const result = await this._db.put(doc);
        if (!result.ok) {
            throw `Failed to update ${doc._id}.${doc._rev}`;
        } else {
            doc._rev = result.rev;
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

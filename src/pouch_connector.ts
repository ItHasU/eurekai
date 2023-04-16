import * as PouchDB from "pouchdb";
import { Txt2ImgOptions } from "./api";
import { txt2img } from "./api";

export enum ComputationStatus {
    PENDING = 1,
    COMPUTING,
    DONE,

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
        this._db.changes({
            live: true // repeat
        }).on("change", (value) => {
            this._scheduleNextIfNeeded();
        });
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

    public async _scheduleNextIfNeeded(): Promise<void> {
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
        console.log(`${pendingPictures.length} picture(s) pending...`);

        if (pendingPictures.length == 0) {
            // We are done
            return;
        } else {
            // -- Generate a new image --
            const doc = pendingPictures[0];
            this._scheduled = this._runNext(doc);
        }
    }

    /**
     * Schedule the 
     */
    protected async _runNext(doc: PictureDTO): Promise<void> {
        try {
            // -- Change status --
            doc.computed = ComputationStatus.COMPUTING;
            await this._db.put(doc);

            // -- Start computation --
            let result = null;
            try {
                result = await txt2img(this._apiUrl, doc.options);
            } catch (e) {
                console.error(e);
                doc.computed = ComputationStatus.PENDING;
                await this._db.put(doc);
                return;
            }

            // -- Save results as attachments --
            for (let i = 0; i < result.images.length; i++) {
                doc._attachments[`${i}.png`] = {
                    content_type: "image/png",
                    data: result.images[i],
                };
            }
            await this._db.put(doc);
        } catch (e) {
            console.error(e);
        }
    }
}

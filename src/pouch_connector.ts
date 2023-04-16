import * as PouchDB from "pouchdb";
import { Txt2ImgOptions } from "./api";

export interface PictureDTO extends PouchDB.Core.IdMeta, PouchDB.Core.RevisionIdMeta {
    /** Options that were used to generate the picture */
    options: Txt2ImgOptions;
    /** Is picture computed */
    computed: boolean;
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

    constructor() {
        this._db = new PouchDB("pictures");
        this._db.changes({
            live: true // repeat
        }).on("change", (value) => {
            this._scheduleNextIfNeeded();
        });
    }


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
            computed: false,
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
            if (picture.doc.computed) {
                continue;
            }

            pendingPictures.push(picture.doc);
        }
        // -- Check that there is a picture --
        console.log(`${pendingPictures.length} picture(s) pending...`);

        // -- Generate a new image --
        setTimeout(() => {
            // Plan generation
        });
    }
}

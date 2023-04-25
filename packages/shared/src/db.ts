import PouchDB from "pouchdb";
import { ComputationStatus, PictureDTO, Txt2ImgOptions } from "./types";

export class DBConnector {
    protected _db: PouchDB.Database<PictureDTO>;

    constructor() {
        this._db = new PouchDB("pictures");
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
            _id: undefined as never,
            _rev: undefined as never,
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

    protected async _update(doc: PictureDTO): Promise<void> {
        const result = await this._db.put(doc);
        if (!result.ok) {
            throw `Failed to update ${doc._id}.${doc._rev}`;
        } else {
            doc._rev = result.rev;
        }
    }

}

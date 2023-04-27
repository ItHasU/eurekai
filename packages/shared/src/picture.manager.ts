import PouchDB from "pouchdb";
import { ComputationStatus, PictureDTO, PromptDTO, Txt2ImgOptions } from "./types";

const DEFAULT_PARAMETERS: Txt2ImgOptions = {
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

export class PictureManager {
    protected _db: PouchDB.Database<PictureDTO>;

    constructor(dbConstructor: ReturnType<PouchDB.Static["defaults"]>) {
        this._db = new dbConstructor("pictures");
    }

    /** Create a picture from a prompt. Won't run it. */
    public async createFromPrompt(
        prompt: PromptDTO): Promise<PictureDTO> {

        const picture: PictureDTO = {
            _id: undefined as never,
            _rev: undefined as never,
            computed: ComputationStatus.PENDING,
            _attachments: {},
            promptId: prompt._id,
            options: {
                ...DEFAULT_PARAMETERS,
                prompt: prompt.prompt,
                negative_prompt: prompt.negative_prompt,
                seed: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
            }
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

    /** Get all images with their attachments */
    public async getImages(): Promise<PictureDTO[]> {
        const result = await this._db.allDocs({
            include_docs: true,
            attachments: true
        });
        return result.rows.map(row => row.doc!);
    }

    /** Erase all images */
    public async clean(): Promise<void> {
        const images = await this.getImages();
        for (const image of images) {
            this._db.remove(image);
        }
    }

    /** Update a DTO in DB */
    protected async _update(doc: PictureDTO): Promise<void> {
        const result = await this._db.put(doc);
        if (!result.ok) {
            throw `Failed to update ${doc._id}.${doc._rev}`;
        } else {
            doc._rev = result.rev;
        }
    }

    /**
     * Compute the image and save it to the database
     */
    public async run(picture: PictureDTO, txt2img: (options: Txt2ImgOptions) => Promise<string[]>): Promise<void> {
        // -- Change status --
        picture.computed = ComputationStatus.COMPUTING;
        await this._update(picture);

        // -- Compute --
        try {
            // Start computation
            const result = await txt2img(picture.options);
            // Save results as attachments
            picture.computed = ComputationStatus.DONE;
            for (let i = 0; i < result.length; i++) {
                picture._attachments[`${i}.png`] = {
                    content_type: "image/png",
                    data: result[i],
                };
            }
            await this._update(picture);
        } catch (e) {
            console.error(e);
            picture.computed = ComputationStatus.ERROR;
            await this._update(picture);
        }
    }
}

import PouchDB from "pouchdb";
import { ComputationStatus, PictureDTO, PromptDTO, Txt2ImgOptions } from "./types";
import { AbstractDatabaseWrapper } from "./abstract.databaseWrapper";

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

    save_images: true
};

export class PicturesWrapper extends AbstractDatabaseWrapper<PictureDTO> {

    constructor(dbConstructor: ReturnType<PouchDB.Static["defaults"]>) {
        super(dbConstructor, "pictures");
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
            picture._attachments = {};
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

import { SDModels } from "@eurekai/shared/src/data";
import { Txt2ImgOptions } from "@eurekai/shared/src/types";

/** Abstract API to connect to an image generator */
export abstract class AbstractAPI {

    //#region Model management

    /** Get the list of models */
    public abstract getModels(): Promise<SDModels[]>;

    /** Get the selected model */
    public abstract getSelectedModel(): Promise<string | null>;

    /** Set the model */
    public abstract setSelectedModel(model: string): Promise<void>;

    //#endregion

    //#region Image generation

    /** Generate an image */
    public abstract txt2img(options: Txt2ImgOptions): Promise<string[]>;

    //#endregion
}
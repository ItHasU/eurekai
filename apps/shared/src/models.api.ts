/** Duration parameter exposed by a workflow */
export interface DurationInfo {
    min: number;
    max: number;
    step: number;
    default: number;
    /** Label displayed next to the input (eg. "seconds", "frames") */
    unit: string;
}

export interface ModelInfo {
    uid: string;
    displayName: string;
    size: number;
    /** Round the generated resolutions to a multiple of this value (defaults to 8) */
    sizeStep?: number;
    video?: boolean;
    /** Display the negative prompt field (defaults to true) */
    negativePrompt?: boolean;
    /** Duration parameter, undefined if the workflow does not expose one */
    duration?: DurationInfo;
}

export const MODELS_URL = "models";

export type ModelsAPI = {
    getModels: (refresh: boolean) => Promise<ModelInfo[]>;
}

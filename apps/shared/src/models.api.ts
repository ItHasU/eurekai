export interface ModelInfo {
    uid: string;
    displayName: string;
    size: number;
    /** Round the generated resolutions to a multiple of this value (defaults to 8) */
    sizeStep?: number;
    video?: boolean;
}

export const MODELS_URL = "models";

export type ModelsAPI = {
    getModels: (refresh: boolean) => Promise<ModelInfo[]>;
}
export interface ModelInfo {
    uid: string;
    displayName: string;
    size: number;
    video?: boolean;
}

export const MODELS_URL = "models";

export type ModelsAPI = {
    getModels: (refresh: boolean) => Promise<ModelInfo[]>;
}
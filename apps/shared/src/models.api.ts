export interface ModelInfo {
    uid: string;
    displayName: string;
    size: number;
}

export const MODELS_URL = "models";

export type ModelsAPI<H> = {
    getModels: (h: H, refresh: boolean) => Promise<ModelInfo[]>;
}
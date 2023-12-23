import { apiCall } from "@dagda/client/api";
import { generateFetchFunction, generateSubmitFunction } from "@dagda/client/sql/client.adapter";
import { SQLHandler } from "@dagda/shared/sql/handler";
import { MODELS_URL, ModelInfo, ModelsAPI } from "@eurekai/shared/src/models.api";
import { APP_FOREIGN_KEYS, AppContexts, AppTables, appContextEquals } from "@eurekai/shared/src/types";

/** A global class containing static methods accessible from all the components */
export class StaticDataProvider {

    //#region SQL Handler -----------------------------------------------------

    protected static _sqlHandler: SQLHandler<AppTables, AppContexts> | null;

    public static get sqlHandler(): SQLHandler<AppTables, AppContexts> {
        if (this._sqlHandler == null) {
            this._sqlHandler = new SQLHandler<AppTables, AppContexts>({
                contextEquals: appContextEquals,
                contextIntersects: appContextEquals,
                fetch: generateFetchFunction(),
                submit: generateSubmitFunction()
            }, APP_FOREIGN_KEYS);
        }
        return this._sqlHandler;
    }

    //#endregion

    //#region Models ----------------------------------------------------------

    protected static _modelsCacheP: Promise<ModelInfo[]> | null = null;
    protected static _modelsCache: ModelInfo[] = [];

    public static getModels(forceRefresh: boolean = false): Promise<ModelInfo[]> {
        if (forceRefresh || this._modelsCacheP == null) {
            this._modelsCacheP = apiCall<ModelsAPI, "getModels">(MODELS_URL, "getModels", forceRefresh).then((modelCache) => {
                this._modelsCache = modelCache;
                return modelCache;
            }).catch(e => {
                console.error(e);
                return [{
                    uid: "!",
                    displayName: "!",
                    size: 512
                }];
            });
        }
        return this._modelsCacheP;
    }

    public static getModelFromCache(uid: string): ModelInfo | null {
        for (const model of this._modelsCache) {
            if (model.uid === uid) {
                return model;
            }
        }
        return null;
    }

    //#endregion

    //#region Selected project ------------------------------------------------

    protected static _selectedProjectId: number | undefined = undefined;

    public static getSelectedProject(): number | undefined {
        return StaticDataProvider._selectedProjectId;
    }

    public static setSelectedProject(projectId: number | undefined): void {
        StaticDataProvider._selectedProjectId = projectId;
    }

    //#endregion

}

(window as any)["data"] = StaticDataProvider;
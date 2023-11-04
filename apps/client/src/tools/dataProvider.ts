import { apiCall } from "@dagda/client/api";
import { generateFetchFunction, generateSubmitFunction } from "@dagda/client/sql/client.adapter";
import { SQLHandler } from "@dagda/shared/sql/handler";
import { MODELS_URL, ModelInfo, ModelsAPI } from "@eurekai/shared/src/models.api";
import { Filters, Tables, filterEquals } from "@eurekai/shared/src/types";

/** A global class containing static methods accessible from all the components */
export class StaticDataProvider {

    //#region SQL Handler -----------------------------------------------------

    protected static _sqlHandler: SQLHandler<Tables, Filters> | null;

    public static get sqlHandler(): SQLHandler<Tables, Filters> {
        if (this._sqlHandler == null) {
            this._sqlHandler = new SQLHandler<Tables, Filters>({
                filterEquals: filterEquals,
                fetch: generateFetchFunction(),
                submit: generateSubmitFunction()
            });
        }
        return this._sqlHandler;
    }

    //#endregion

    //#region Models ----------------------------------------------------------

    protected static _modelsCache: Promise<ModelInfo[]> | null = null;

    public static getModels(forceRefresh: boolean = false): Promise<ModelInfo[]> {
        if (forceRefresh || this._modelsCache == null) {
            this._modelsCache = apiCall<ModelsAPI, "getModels">(MODELS_URL, "getModels", forceRefresh).catch(e => {
                console.error(e);
                return [{
                    uid: "!",
                    displayName: "!",
                    size: 512
                }];
            });
        }
        return this._modelsCache;
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
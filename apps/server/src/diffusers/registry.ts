import { getEnvString, getEnvStringOptional } from "@dagda/server/tools/config";
import { ENV_VARIABLES_STR } from "src/modules/config";
import { AbstractDiffuser } from "./diffuser";
import { getAllModelsWithWOL } from "./impl/automatic1111.tools";
import { getAllComfyTemplates } from "./impl/comfyui";

export class DiffusersRegistry {

    protected static readonly _models: Map<string, AbstractDiffuser> = new Map();

    /** Initialize the registry with all the models it can find by itself */
    public static async fetchAllModels(): Promise<void> {
        // -- Clear --
        DiffusersRegistry._models.clear();

        // -- Fetch ComfyUI models --------------------------------------------
        try {
            const comfy_host = getEnvString<ENV_VARIABLES_STR>("COMFY_HOST");
            const comfy_path = getEnvString<ENV_VARIABLES_STR>("COMFY_PATH");
            const comfy_wolScript = getEnvStringOptional<ENV_VARIABLES_STR>("COMFY_WOL_SCRIPT");
            if (comfy_host != null) {
                const comfy_models = await getAllComfyTemplates(comfy_host, comfy_path, comfy_wolScript);
                for (const model of comfy_models) {
                    DiffusersRegistry.push(model);
                }
            }
        } catch (e) {
            console.error(e);
        }

        // -- Fetch A1111 models ----------------------------------------------
        try {
            const automatic1111_apiUrl = getEnvString<ENV_VARIABLES_STR>("API_URL");
            const automatic1111_wolScript = getEnvStringOptional<ENV_VARIABLES_STR>("API_WOL_SCRIPT");
            if (automatic1111_apiUrl != null) {
                const a1111_models = await (getAllModelsWithWOL(automatic1111_apiUrl, automatic1111_wolScript) as Promise<AbstractDiffuser[]>);
                for (const model of a1111_models) {
                    DiffusersRegistry.push(model);
                }
            }
        } catch (e) {
            console.error(e);
        }
    }

    /** Register a diffuser */
    public static push(model: AbstractDiffuser): void {
        DiffusersRegistry._models.set(model.getModelInfo().uid, model);
    }

    /** Get the model corresponding to the given title or undefined if not found */
    public static getModel(title: string): AbstractDiffuser | undefined {
        return DiffusersRegistry._models.get(title);
    }

    /** Get all the models */
    public static getModels(): AbstractDiffuser[] {
        return [...DiffusersRegistry._models.values()];
    }


}
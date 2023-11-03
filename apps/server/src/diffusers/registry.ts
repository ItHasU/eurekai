import { AbstractDiffuser } from "./diffuser";
import { getAllModels } from "./impl/automatic1111.tools";

export class DiffusersRegistry {

    protected static readonly _models: Map<string, AbstractDiffuser> = new Map();

    /** Initialize the registry with all the models it can find by itself */
    public static async fetchAllModels(options: {
        automatic1111_apiUrl?: string
    }): Promise<void> {
        // -- Clear --
        DiffusersRegistry._models.clear();

        // -- Fetch A1111 models --
        if (options.automatic1111_apiUrl != null) {
            const a1111_models = await getAllModels(options.automatic1111_apiUrl);
            for (const model of a1111_models) {
                DiffusersRegistry._models.set(model.getTitle(), model);
            }
        }
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
import { registerAPI } from "@dagda/server/api";
import { registerAdapterAPI } from "@dagda/server/sql/api.adapter";
import { SQLiteHelper } from "@dagda/server/sql/sqlite.helper";
import { Data } from "@dagda/shared/sql/types";
import { MODELS_URL, ModelInfo, ModelsAPI } from "@eurekai/shared/src/models.api";
import { AppContexts, AppTables, AttachmentDTO, ComputationStatus, PictureDTO, ProjectDTO, PromptDTO, SeedDTO, f, t } from "@eurekai/shared/src/types";
import express, { Application } from "express";
import { resolve } from "node:path";
import { DiffusersRegistry } from "src/diffusers";

/** Initialize an Express app and register the routes */
export async function initHTTPServer(db: SQLiteHelper<AppTables>, port: number): Promise<void> {
    const app = express();
    app.use(express.json());

    // -- Register client files routes --
    const path: string = resolve("./apps/client/dist");
    app.use(express.static(path));

    // -- Register SQL routes --
    registerAdapterAPI<AppTables, AppContexts>(app, db, sqlFetch);

    // -- Register models routes --
    _registerModelsAPI(app);

    // -- Register attachments route --
    app.get("/attachment/:id", async (req, res) => {
        // Send attachment as a png image from the base 64 string
        const id = +req.params.id;
        try {
            const attachment = await db.get<AttachmentDTO>(`SELECT * FROM ${t("attachments")} WHERE ${f("attachments", "id")}=?`, [id]);
            if (!attachment) {
                res.status(404).send(`Attachment ${id} not found`);
            } else {
                var img = Buffer.from(attachment.data, 'base64');

                res.writeHead(200, {
                    'Content-Type': 'image/png',
                    'Content-Length': img.length,
                    'Cache-Control': 'max-age=86400' // 1 day in seconds
                });
                res.end(img);
            }
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: new String(err) });
        }
    });

    // -- Listen --
    app.listen(port);
}

/** 
 * Fetch function for the app.  
 * This function must return the records that match the filter
 */
export async function sqlFetch(helper: SQLiteHelper<AppTables>, filter: AppContexts): Promise<Data<AppTables>> {
    switch (filter.type) {
        case "projects":
            return {
                projects: await helper.all<ProjectDTO>("SELECT * FROM projects")
            };
        case "project":
            return {
                projects: await helper.all<ProjectDTO>("SELECT * FROM projects WHERE id=?", [filter.options.projectId]),
                prompts: await helper.all<PromptDTO>("SELECT * FROM prompts WHERE projectId=?", [filter.options.projectId]),
                pictures: await helper.all<PictureDTO>("SELECT pictures.* FROM pictures JOIN prompts ON pictures.promptId = prompts.id WHERE prompts.projectId = ?", [filter.options.projectId]),
                // attachments: not fetch using cache but through a custom route
                seeds: await helper.all<SeedDTO>(`SELECT * FROM ${t("seeds")} WHERE ${f("seeds", "projectId")}=?`, [filter.options.projectId])
            }
        case "pending":
            return {
                projects: await helper.all<ProjectDTO>("SELECT * FROM projects"),
                prompts: await helper.all<PromptDTO>("SELECT prompts.* FROM pictures LEFT JOIN prompts ON prompts.id = pictures.promptId WHERE pictures.status = ?", [ComputationStatus.PENDING]),
                pictures: await helper.all<PictureDTO>("SELECT pictures.* FROM pictures WHERE pictures.status = ?", [ComputationStatus.PENDING])
            }
        default:
            return {};
    }
}

function _registerModelsAPI(app: Application): void {
    registerAPI<ModelsAPI>(app, MODELS_URL, {
        getModels: async (refresh: boolean): Promise<ModelInfo[]> => {
            if (refresh) {
                await DiffusersRegistry.fetchAllModels();
            }

            const res: ModelInfo[] = [];
            for (const model of await DiffusersRegistry.getModels()) {
                res.push(model.getModelInfo());
            }
            return res;
        }
    });
}

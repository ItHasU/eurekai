import { registerAPI } from "@dagda/server/api";
import { registerAdapterAPI } from "@dagda/server/sql/api.adapter";
import { AbstractSQLRunner } from "@dagda/server/sql/runner";
import { ServerNotificationImpl } from "@dagda/server/tools/notification.impl";
import { Data } from "@dagda/shared/sql/types";
import { NotificationHelper } from "@dagda/shared/tools/notification.helper";
import { MODELS_URL, ModelInfo, ModelsAPI } from "@eurekai/shared/src/models.api";
import { APP_MODEL, AppContexts, AppTables, AttachmentDTO, ComputationStatus, PictureDTO, ProjectDTO, PromptDTO, SeedDTO } from "@eurekai/shared/src/types";
import express, { Application } from "express";
import { resolve } from "node:path";
import { DiffusersRegistry } from "src/diffusers";

/** Initialize an Express app and register the routes */
export async function initHTTPServer(db: AbstractSQLRunner<AppTables>, port: number): Promise<void> {
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
            const attachment = await db.get<AttachmentDTO>(`SELECT * FROM ${APP_MODEL.qt("attachments")} WHERE ${APP_MODEL.qf("attachments", "id")}=$1`, id);
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
    const server = app.listen(port);

    // -- Register websocket notification --
    NotificationHelper.set(new ServerNotificationImpl(server));
}

/** 
 * Fetch function for the app.  
 * This function must return the records that match the filter
 */
export async function sqlFetch(helper: AbstractSQLRunner<AppTables>, filter: AppContexts): Promise<Data<AppTables>> {
    switch (filter.type) {
        case "projects":
            return {
                projects: await helper.all<ProjectDTO>(`SELECT * FROM ${APP_MODEL.qt("projects")}`)
            };
        case "project":
            return {
                projects: await helper.all<ProjectDTO>(`SELECT * FROM ${APP_MODEL.qt("projects")} WHERE ${APP_MODEL.qf("projects", "id")} = $1`, filter.options.projectId),
                prompts: await helper.all<PromptDTO>(`SELECT * FROM ${APP_MODEL.qt("prompts")} WHERE ${APP_MODEL.qf("prompts", "projectId")} = $1`, filter.options.projectId),
                pictures: await helper.all<PictureDTO>(`SELECT ${APP_MODEL.qt("pictures")}.* FROM ${APP_MODEL.qt("pictures")} JOIN ${APP_MODEL.qt("prompts")} ON ${APP_MODEL.qf("pictures", "promptId")} = ${APP_MODEL.qf("prompts", "id")} WHERE ${APP_MODEL.qf("prompts", "projectId")} = $1`, filter.options.projectId),
                // attachments: not fetch using cache but through a custom route
                seeds: await helper.all<SeedDTO>(`SELECT * FROM ${APP_MODEL.qt("seeds")} WHERE ${APP_MODEL.qf("seeds", "projectId")} = $1`, filter.options.projectId)
            }
        case "pending":
            return {
                projects: await helper.all<ProjectDTO>(`SELECT * FROM ${APP_MODEL.qt("projects")}`),
                prompts: await helper.all<PromptDTO>(`SELECT ${APP_MODEL.qt("prompts")}.* FROM ${APP_MODEL.qt("pictures")} LEFT JOIN ${APP_MODEL.qt("prompts")} ON ${APP_MODEL.qf("prompts", "id")} = ${APP_MODEL.qf("pictures", "promptId")} WHERE ${APP_MODEL.qf("pictures", "status")} = $1`, ComputationStatus.PENDING),
                pictures: await helper.all<PictureDTO>(`SELECT ${APP_MODEL.qt("pictures")}.* FROM ${APP_MODEL.qt("pictures")} WHERE ${APP_MODEL.qf("pictures", "status")} = $1`, ComputationStatus.PENDING)
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

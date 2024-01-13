import { registerAPI } from "@dagda/server/api";
import { AuthHandler } from "@dagda/server/express/auth";
import { registerAdapterAPI } from "@dagda/server/sql/api.adapter";
import { AbstractSQLRunner } from "@dagda/server/sql/runner";
import { ServerNotificationImpl } from "@dagda/server/tools/notification.impl";
import { Data } from "@dagda/shared/entities/types";
import { NotificationHelper } from "@dagda/shared/tools/notification.helper";
import { AppContexts, AppTables, AttachmentEntity, ComputationStatus, PictureEntity, ProjectEntity, PromptEntity, SeedEntity } from "@eurekai/shared/src/entities";
import { MODELS_URL, ModelInfo, ModelsAPI } from "@eurekai/shared/src/models.api";
import express, { Application } from "express";
import { resolve } from "node:path";
import { DiffusersRegistry } from "src/diffusers";
const GoogleStrategy = require('passport-google-oidc');

/** Initialize an Express app and register the routes */
export async function initHTTPServer(db: AbstractSQLRunner<any, any>, port: number): Promise<void> {
    const app = express();

    const auth: AuthHandler = new AuthHandler(app);
    auth.registerStrategy({
        name: "google",
        displayName: "Google",
        strategy: new GoogleStrategy({
            clientID: process.env['GOOGLE_CLIENT_ID'],
            clientSecret: process.env['GOOGLE_CLIENT_SECRET'],
            callbackURL: AuthHandler.getCallbackURL("google"),
            scope: ['profile']
        }, function verify(issuer: any, profile: any, cb: (err: any, user: any) => void) {
            console.log(issuer, profile);
            cb(null, profile);
        })
    });

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
            const attachment = await db.get<AttachmentEntity>(`SELECT * FROM ${db.qt("attachments")} WHERE ${db.qf("attachments", "id")}=$1`, id);
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
export async function sqlFetch(helper: AbstractSQLRunner<any, any>, filter: AppContexts): Promise<Data<AppTables>> {
    switch (filter.type) {
        case "projects":
            return {
                projects: await helper.all<ProjectEntity>(`SELECT * FROM ${helper.qt("projects")}`)
            };
        case "project":
            return {
                projects: await helper.all<ProjectEntity>(`SELECT * FROM ${helper.qt("projects")} WHERE ${helper.qf("projects", "id")} = $1`, filter.options.projectId),
                prompts: await helper.all<PromptEntity>(`SELECT * FROM ${helper.qt("prompts")} WHERE ${helper.qf("prompts", "projectId")} = $1`, filter.options.projectId),
                pictures: await helper.all<PictureEntity>(`SELECT ${helper.qt("pictures")}.* FROM ${helper.qt("pictures")} JOIN ${helper.qt("prompts")} ON ${helper.qf("pictures", "promptId")} = ${helper.qf("prompts", "id")} WHERE ${helper.qf("prompts", "projectId")} = $1`, filter.options.projectId),
                // attachments: not fetch using cache but through a custom route
                seeds: await helper.all<SeedEntity>(`SELECT * FROM ${helper.qt("seeds")} WHERE ${helper.qf("seeds", "projectId")} = $1`, filter.options.projectId)
            }
        case "pending":
            return {
                projects: await helper.all<ProjectEntity>(`SELECT * FROM ${helper.qt("projects")}`),
                prompts: await helper.all<PromptEntity>(`SELECT ${helper.qt("prompts")}.* FROM ${helper.qt("pictures")} LEFT JOIN ${helper.qt("prompts")} ON ${helper.qf("prompts", "id")} = ${helper.qf("pictures", "promptId")} WHERE ${helper.qf("pictures", "status")} = $1`, ComputationStatus.PENDING),
                pictures: await helper.all<PictureEntity>(`SELECT ${helper.qt("pictures")}.* FROM ${helper.qt("pictures")} WHERE ${helper.qf("pictures", "status")} = $1`, ComputationStatus.PENDING)
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

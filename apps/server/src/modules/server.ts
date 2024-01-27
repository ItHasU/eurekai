import { registerAPI } from "@dagda/server/api";
import { AuthHandler } from "@dagda/server/express/auth";
import { registerAdapterAPI } from "@dagda/server/sql/api.adapter";
import { AbstractSQLRunner } from "@dagda/server/sql/runner";
import { getEnvString } from "@dagda/server/tools/config";
import { ServerNotificationImpl } from "@dagda/server/tools/notification.impl";
import { asNamed } from "@dagda/shared/entities/named.types";
import { Data } from "@dagda/shared/entities/types";
import { NotificationHelper } from "@dagda/shared/tools/notification.helper";
import { AppContexts, AppTables, AttachmentEntity, ComputationStatus, PictureEntity, ProjectEntity, PromptEntity, SeedEntity, UserEntity } from "@eurekai/shared/src/entities";
import { MODELS_URL, ModelInfo, ModelsAPI } from "@eurekai/shared/src/models.api";
import express, { Application } from "express";
import { resolve } from "node:path";
import passport from "passport";
import { DiffusersRegistry } from "src/diffusers";
import { buildServerEntitiesHandler } from "./entities.handler";

/** Initialize an Express app and register the routes */
export async function initHTTPServer(db: AbstractSQLRunner<any, any>, baseURL: string, port: number): Promise<void> {
    const app = express();

    const auth: AuthHandler = new AuthHandler(app, baseURL, async (profile: passport.Profile) => {
        try {
            const handler = buildServerEntitiesHandler(db);
            await handler.fetch({ type: "users", "options": undefined });
            // Search for the user
            const userEntity = handler.getItems("users").find(user => user.uid === profile.id);
            if (userEntity == null) {
                // We need to create the user
                await handler.withTransaction((tr) => {
                    tr.insert("users", {
                        id: asNamed(0),
                        uid: asNamed(profile.id),
                        displayName: asNamed(profile.displayName),
                        enabled: asNamed(false)
                    });
                });
                await handler.waitForSubmit();
                return false;
            } else {
                return userEntity.enabled;
            }
        } catch (err) {
            console.error(err);
            return false;
        }
    });
    // Read the google client id and secret from the environment variables
    const clientID = getEnvString("GOOGLE_CLIENT_ID");
    const clientSecret = getEnvString("GOOGLE_CLIENT_SECRET");
    if (!clientID || !clientSecret) {
        throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables");
    }
    auth.registerGoogleStrategy(clientID, clientSecret);
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
        case "users":
            return {
                users: await helper.all<UserEntity>(`SELECT * FROM ${helper.qt("users")}`)
            };
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
                prompts: await helper.all<PromptEntity>(`SELECT ${helper.qt("prompts")}.* FROM ${helper.qt("pictures")} LEFT JOIN ${helper.qt("prompts")} ON ${helper.qf("prompts", "id")} = ${helper.qf("pictures", "promptId")} WHERE ${helper.qf("pictures", "status")} = $1 OR ${helper.qf("pictures", "highresStatus")} = $1`, ComputationStatus.PENDING),
                pictures: await helper.all<PictureEntity>(`SELECT ${helper.qt("pictures")}.* FROM ${helper.qt("pictures")} WHERE ${helper.qf("pictures", "status")} = $1 OR ${helper.qf("pictures", "highresStatus")} = $1`, ComputationStatus.PENDING)
            }
        default:
            throw new Error(`Unsupported fetch context`);
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

import { registerAPI } from "@dagda/server/api";
import { AuthHandler } from "@dagda/server/express/auth";
import { AbstractSQLRunner } from "@dagda/server/sql/runner";
import { generateSubmit } from "@dagda/server/sql/sql.adapter";
import { getEnvStringOptional } from "@dagda/server/tools/config";
import { ServerNotificationImpl } from "@dagda/server/tools/notification.impl";
import { asNamed } from "@dagda/shared/entities/named.types";
import { Data } from "@dagda/shared/entities/types";
import { SQLAdapterAPI, SQL_URL } from "@dagda/shared/sql/api";
import { OperationType } from "@dagda/shared/sql/transaction";
import { NotificationHelper } from "@dagda/shared/tools/notification.helper";
import { APP_MODEL, AppContexts, AppTables, AttachmentEntity, ComputationStatus, PictureEntity, PictureType, ProjectEntity, PromptEntity, SeedEntity, SourceImageEntity, UserEntity } from "@eurekai/shared/src/entities";
import { MODELS_URL, ModelInfo, ModelsAPI } from "@eurekai/shared/src/models.api";
import { SYSTEM_URL, SystemAPI, SystemInfo } from "@eurekai/shared/src/system.api";
import express, { Application } from "express";
import { resolve } from "node:path";
import passport from "passport";
import { DiffusersRegistry } from "src/diffusers";
import { qf, qt } from "./db";
import { buildServerEntitiesHandler } from "./entities.handler";
import { THUMBNAIL_MIME_TYPE, getOrCreateThumbnail } from "./thumbnail";

const APP_START_TIME_MS = new Date().getTime();

/** Initialize an Express app and register the routes */
export async function initHTTPServer(db: AbstractSQLRunner, baseURL: string, port: number): Promise<void> {
    const app = express();

    // -- Update pictures with status computing --
    // Mark all pictures with status computing to error as once the server is restarted
    // there is no way to handle pictures with this state.
    // Note : We could also have passed the status to pending, but if the server reboots due to an
    // error during generation, this could create an infinite loop and the user would not be 
    // notified of the problem.
    try {
        await db.run(`UPDATE ${qt("pictures")} SET ${qf("pictures", "status", false)}=${ComputationStatus.ERROR} WHERE ${qf("pictures", "status", false)}=${ComputationStatus.COMPUTING}`);
    } catch (e) {
        console.error("An error occurred while handing computing pictures at startup");
        console.error(e);
    }

    // -- Create the authentication handler --
    // Read the google client id and secret from the environment variables
    const clientID = getEnvStringOptional("GOOGLE_CLIENT_ID");
    const clientSecret = getEnvStringOptional("GOOGLE_CLIENT_SECRET");
    if (clientID == null || clientSecret == null) {
        console.warn(`GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not found in environment variables, authentication is disabled`);
        const noAuth = getEnvStringOptional("NO_AUTH");
        if (noAuth == null) {
            throw "For security reason, NO_AUTH variable is required when auth variables are left empty";
        } else {
            console.log("Authentication is disabled on purpose, continuing...");
        }
    } else {
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
        auth.registerGoogleStrategy(clientID, clientSecret);
    }

    // -- JSON parsing middleware --
    // Explicit limit : the default (100kb) is too small once a source image (base64) is
    // submitted through the generic entities "submit" endpoint.
    app.use(express.json({ limit: "15mb" }));

    // -- Register client files routes --
    const path: string = resolve("./apps/client/dist");
    app.use(express.static(path));

    // -- Register SQL routes --
    const submit = generateSubmit<AppTables, AppContexts>(db, APP_MODEL);
    registerAPI<SQLAdapterAPI<AppTables, AppContexts>>(app, SQL_URL, {
        submit: async (transactionData) => {
            const result = await submit(transactionData);
            // An attachment is not owned by a single row : a generated picture can be reused as
            // the source image of another project, and a project displays one of its pictures as
            // its thumbnail. Clients therefore never delete an attachment themselves, they just
            // drop what references it and we collect the ones nobody points to anymore.
            if (transactionData.operations.some(operation => operation.type === OperationType.DELETE)) {
                await _deleteOrphanAttachments(db);
            }
            return result;
        },
        fetch: (filter) => sqlFetch(db, filter)
    });

    // -- Register models routes --
    _registerAPIs(app);

    // -- Register thumbnail route --
    // Serves a downscaled version of a media, generated on the first request and then cached
    // in database : pictures are resized, videos get a poster frame extracted from them.
    // Redirects to the full size attachment when a picture could not be resized, so a missing
    // thumbnail never leaves a broken image.
    app.get("/attachment/:id/thumbnail", async (req, res) => {
        const id = +req.params.id;
        try {
            const thumbnail = await getOrCreateThumbnail(db, id);
            if (thumbnail === "fallback") {
                res.redirect(302, `/attachment/${id}`);
                return;
            }
            if (thumbnail == null) {
                res.status(404).send(`No thumbnail for attachment ${id}`);
                return;
            }
            res.writeHead(200, {
                'Content-Type': THUMBNAIL_MIME_TYPE,
                'Content-Length': thumbnail.length,
                // An attachment never changes once stored, so neither does its thumbnail
                'Cache-Control': 'max-age=31536000, immutable'
            });
            res.end(thumbnail);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: new String(err) });
        }
    });

    // -- Register attachments route --
    app.get("/attachment/:id", async (req, res) => {
        // Send attachment as a png image from the base 64 string
        const id = +req.params.id;
        try {
            // Columns are listed explicitly : a SELECT * would also read the thumbnail,
            // which is of no use here and only makes the query heavier.
            const attachment = await db.get<AttachmentEntity>(`SELECT ${qf("attachments", "type")}, ${qf("attachments", "data")} FROM ${qt("attachments")} WHERE ${qf("attachments", "id")}=$1`, id);
            if (!attachment) {
                res.status(404).send(`Attachment ${id} not found`);
            } else if (attachment.type === PictureType.UNKNOWN) {
                res.status(500).send(`Attachment ${id} with unknown type (retry later)`);
            } else {
                var img = Buffer.from(attachment.data, 'base64');

                res.writeHead(200, {
                    // Detect the png prefix else we expect the content to be a video
                    'Content-Type': attachment.type === PictureType.VIDEO ? 'video/mp4' : 'image/png' /* Fallback to image */,
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
 * Delete the attachments that are not referenced anymore.
 * Attachments hold the image data, leaving them behind would grow the database forever.
 */
async function _deleteOrphanAttachments(db: AbstractSQLRunner): Promise<void> {
    try {
        await db.run(`DELETE FROM ${qt("attachments")} WHERE`
            + ` NOT EXISTS (SELECT 1 FROM ${qt("pictures")} WHERE ${qf("pictures", "attachmentId")} = ${qf("attachments", "id")})`
            + ` AND NOT EXISTS (SELECT 1 FROM ${qt("sources")} WHERE ${qf("sources", "attachmentId")} = ${qf("attachments", "id")})`
            + ` AND NOT EXISTS (SELECT 1 FROM ${qt("projects")} WHERE ${qf("projects", "featuredAttachmentId")} = ${qf("attachments", "id")})`);
    } catch (e) {
        // The transaction itself succeeded, a failed cleanup must not be reported as a failed delete
        console.error("Failed to delete orphan attachments");
        console.error(e);
    }
}

/** 
 * Fetch function for the app.  
 * This function must return the records that match the filter
 */
export async function sqlFetch(helper: AbstractSQLRunner, filter: AppContexts): Promise<Data<AppTables>> {
    switch (filter.type) {
        case "users":
            return {
                users: await helper.all<UserEntity>(`SELECT * FROM ${qt("users")}`)
            };
        case "projects":
            return {
                projects: await helper.all<ProjectEntity>(`SELECT * FROM ${qt("projects")}`)
            };
        case "project":
            return {
                projects: await helper.all<ProjectEntity>(`SELECT * FROM ${qt("projects")} WHERE ${qf("projects", "id")} = $1`, filter.options.projectId),
                prompts: await helper.all<PromptEntity>(`SELECT * FROM ${qt("prompts")} WHERE ${qf("prompts", "projectId")} = $1`, filter.options.projectId),
                pictures: await helper.all<PictureEntity>(`SELECT ${qt("pictures")}.* FROM ${qt("pictures")} JOIN ${qt("prompts")} ON ${qf("pictures", "promptId")} = ${qf("prompts", "id")} WHERE ${qf("prompts", "projectId")} = $1`, filter.options.projectId),
                // attachments: not fetch using cache but through a custom route
                seeds: await helper.all<SeedEntity>(`SELECT * FROM ${qt("seeds")} WHERE ${qf("seeds", "projectId")} = $1`, filter.options.projectId),
                sources: await helper.all<SourceImageEntity>(`SELECT * FROM ${qt("sources")} WHERE ${qf("sources", "projectId")} = $1`, filter.options.projectId)
            }
        case "pending":
            return {
                projects: await helper.all<ProjectEntity>(`SELECT * FROM ${qt("projects")}`),
                prompts: await helper.all<PromptEntity>(`SELECT ${qt("prompts")}.* FROM ${qt("pictures")} LEFT JOIN ${qt("prompts")} ON ${qf("prompts", "id")} = ${qf("pictures", "promptId")} WHERE ${qf("pictures", "status")} = $1`, ComputationStatus.PENDING),
                pictures: await helper.all<PictureEntity>(`SELECT ${qt("pictures")}.* FROM ${qt("pictures")} WHERE ${qf("pictures", "status")} = $1`, ComputationStatus.PENDING)
            }
        default:
            throw new Error(`Unsupported fetch context`);
            return {};
    }
}

function _registerAPIs(app: Application): void {
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

    const lastErrors: string[] = [];
    process.on('uncaughtException', (err) => {
        lastErrors.push("" + err);
        console.error(err);
    });

    registerAPI<SystemAPI>(app, SYSTEM_URL, {
        getSystemInfo: function (): Promise<SystemInfo> {
            return Promise.resolve({
                startTimeMilliseconds: APP_START_TIME_MS,
                errors: lastErrors
            });
        },
        triggerError: function (): Promise<void> {
            setTimeout(() => {
                throw new Error("Uncaught exception test");
            }, 0);
            return Promise.resolve();
        }
    })
}

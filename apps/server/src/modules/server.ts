import { registerAdapterAPI } from "@dagda/server/sql/api.adapter";
import { SQLiteHelper } from "@dagda/server/sql/sqlite.helper";
import { Data } from "@dagda/shared/sql/types";
import { Filters, ProjectDTO, PromptDTO, Tables } from "@eurekai/shared/src/types";
import express from "express";
import { resolve } from "node:path";

/** Initialize an Express app and register the routes */
export async function initHTTPServer(db: SQLiteHelper<Tables>, port: number): Promise<void> {
    const app = express();
    app.use(express.json());

    // -- Register client files routes --
    const path: string = resolve("./apps/client/dist");
    app.use(express.static(path));

    // -- Register SQL routes --
    registerAdapterAPI<Tables, Filters>(app, db, _fetch);

    // -- Listen --
    app.listen(port);
}

/** 
 * Fetch function for the app.  
 * This function must return the records that match the filter
 */
async function _fetch(helper: SQLiteHelper<Tables>, filter: Filters): Promise<Data<Tables>> {
    switch (filter.type) {
        case "projects":
            return {
                projects: await helper.all<ProjectDTO>("SELECT * FROM projects")
            };
        case "project":
            return {
                projects: await helper.all<ProjectDTO>("SELECT * FROM projects WHERE id=?", [filter.options.projectId]),
                prompts: await helper.all<PromptDTO>("SELECT * FROM prompts WHERE projectId=?", [filter.options.projectId]),
            }
        default:
            return {};
    }
}

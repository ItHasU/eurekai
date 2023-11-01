import { registerAPI } from "@dagda/server/api";
import { SQLiteConnector } from "@dagda/server/sql/sqlite.connector";
import { FETCHER_URL, FetcherAPI, Filters, ProjectDTO, PromptDTO, Tables } from "@eurekai/shared/src/types";
import { Application } from "express";

export function registerFetchAPI(app: Application, connector: SQLiteConnector<Tables>): void {
    const api: FetcherAPI = {
        fetch: async (filter: Filters) => {
            switch (filter.type) {
                case "projects":
                    return {
                        projects: await connector.all<ProjectDTO>("SELECT * FROM projects")
                    };
                case "project":
                    return {
                        projects: await connector.all<ProjectDTO>("SELECT * FROM projects WHERE id=?", [filter.options.projectId]),
                        prompts: await connector.all<PromptDTO>("SELECT * FROM prompts WHERE projectId=?", [filter.options.projectId]),
                    }
                default:
                    return {};
            }
        }
    }
    registerAPI(app, FETCHER_URL, api);
}
import { AbstractDataWrapper } from "./data";
import { PictureDTO, ProjectDTO, ProjectWithStats, PromptDTO } from "./types";

/**
 * This class is a cache of data for the application.
 * 
 * You can use it to retrieve data from the server.
 * Data will be cached in memory until markDirty() is called.
 * 
 * Most of the data is specific to the selected project.
 */
export class DataCache {

    /** Global list of projects */
    protected _projectsCache: Promise<ProjectWithStats[]> | null = null;
    /** List of prompts for the selected project */
    protected _promptsCache: Promise<PromptDTO[]> | null = null;
    /** List of pictures for the selected project */
    protected _picturesCache: Promise<PictureDTO[]> | null = null;

    protected _selectedProjectId: number | null = null;

    constructor(protected readonly _data: AbstractDataWrapper) {
    }

    //#region Global methods --------------------------------------------------

    /** Empty the cache */
    public markDirty(): void {
        this._projectsCache = null;
        this._promptsCache = null;
        this._picturesCache = null;
    }

    /** 
     * This method allows you to perform operation with the data wrapper.
     * Cache will automatically be marked dirty at the end of the callback.
     * 
     * If the callback throws an error, the cache will still be marked dirty.
     * The error will be rethrown.
     * 
     * @param callback The callback to execute
     */
    public async withData<T>(callback: (data: AbstractDataWrapper) => Promise<T>): Promise<T> {
        try {
            return await callback(this._data);
        } finally {
            this.markDirty();
        }
    }

    //#endregion

    //#region Projects --------------------------------------------------------

    /** Get the list of projects */

    public async getProjects(): Promise<ProjectWithStats[]> {
        if (this._projectsCache == null) {
            this._projectsCache = this._data.getProjectsWithStats();
        }
        return this._projectsCache;
    }

    /** Get a project by its id */
    public async getProject(id: number): Promise<ProjectWithStats | null> {
        const projects = await this.getProjects();
        return projects.find(x => x.id === id) ?? null;
    }

    //#endregion

    //#region Project selection -----------------------------------------------

    /** Get the id of the selected project */
    public getSelectedProjectId(): number | null {
        return this._selectedProjectId;
    }

    /** Set the id of the selected project */
    public async setSelectedProjectId(id: number | null): Promise<void> {
        if (this._selectedProjectId !== id) {
            this._selectedProjectId = id;
            this.markDirty();
        }
    }

    //#endregion

    //#region Prompts ---------------------------------------------------------

    /** Get the list of prompts */
    public async getPrompts(): Promise<PromptDTO[]> {
        if (this._selectedProjectId == null) {
            return Promise.resolve([]);
        }
        if (this._promptsCache == null) {
            this._promptsCache = this._data.getPrompts(this._selectedProjectId);
        }
        return this._promptsCache;
    }

    /** Get a specific prompt */
    public async getPrompt(id: number): Promise<PromptDTO | null> {
        const prompts = await this.getPrompts();
        return prompts.find(x => x.id === id) ?? null;
    }

    //#endregion

    //#region Pictures --------------------------------------------------------

    /** Get all pictures for a project */
    public async getPictures(): Promise<PictureDTO[]> {
        if (this._selectedProjectId == null) {
            return Promise.resolve([]);
        }
        if (this._picturesCache == null) {
            this._picturesCache = this._data.getPictures(this._selectedProjectId);
        }
        return this._picturesCache;
    }

    //#endregion

}
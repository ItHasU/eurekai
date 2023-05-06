import { PictureDTO, ProjectDTO, PromptDTO } from "@eurekai/shared/src/types";
import { DatabaseWrapper } from "./db";

export class ProjectWrapper {

    protected _project: ProjectDTO | null = null;
    protected _prompts: PromptDTO[] = [];
    protected _pictures: PictureDTO[] = [];

    /** 
     * Constructor for a project wrapper.
     * This class is used to manage a project in the database.
     * 
     * The constructor won't load any data from the database.
     * You must call `refresh()` to load the data.
     * 
     * FIXME Make this class abstract to DatabaseWrapper.
     */
    constructor(protected _db: DatabaseWrapper, public readonly id: number) { }

    /** Load the data for the project (except attachments that are not dynamically loaded) */
    public async refresh(): Promise<void> {
        this._project = await this._db.getProject(this.id);
    }
}
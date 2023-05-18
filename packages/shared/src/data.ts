import { ComputationStatus, PictureDTO, ProjectDTO, ProjectWithStats, PromptDTO } from "./types";

export abstract class AbstractDataWrapper {

    //#region Projects

    /** Get the list of projects */
    public abstract getProjects(): Promise<ProjectDTO[]>;

    /** Get the list of projects with extended statistics */
    public abstract getProjectsWithStats(): Promise<ProjectWithStats[]>;

    /** Get a project by its id */
    public abstract getProject(id: number): Promise<ProjectDTO | null>;

    /** Add a new project */
    public abstract addProject(name: string, width: number, height: number): Promise<number>;

    /** Update the project properties */
    public abstract updateProject(projectId: number, name: string, width: number, height: number): Promise<void>;

    /** Delete the project and data referencing it */
    public abstract deleteProject(projectId: number): Promise<void>;

    /** 
     * Clean a project
     * - Delete all rejected pictures.
     * - Stop all prompts.
     */
    public abstract cleanProject(id: number): Promise<void>;

    //#endregion

    //#region Prompts

    /** Get the list of prompts */
    public abstract getPrompts(projectId: number): Promise<PromptDTO[]>;

    /** Get a specific prompt */
    public abstract getPrompt(id: number): Promise<PromptDTO>;

    /** Add a prompt to the project */
    public abstract addPrompt(entry: Omit<PromptDTO, "id" | "orderIndex">): Promise<void>;

    /** Toggle prompt active state */
    public abstract setPromptActive(id: number, active: boolean): Promise<void>;

    //#endregion

    //#region Pictures

    /** Get all pictures for a project */
    public abstract getPictures(projectId: number, promptId?: number): Promise<PictureDTO[]>;

    /** Mark picture as accepted or rejected */
    public abstract setPictureStatus(id: number, status: ComputationStatus.ACCEPTED | ComputationStatus.REJECTED): Promise<void>;

    //#endregion

    //#region Attachments

    /** Get the attachment data */
    public abstract getAttachment(id: number): Promise<string>;

}
import { ComputationStatus, PictureDTO, ProjectDTO, PromptDTO } from "./types";

export abstract class AbstractDataWrapper {

    //#region Projects

    /** Get the list of projects */
    public abstract getProjects(): Promise<ProjectDTO[]>;

    /** Get a project by its id */
    public abstract getProject(id: number): Promise<ProjectDTO | null>;

    /** Add a new project */
    public abstract addProject(name: string): Promise<number>;

    //#endregion

    //#region Prompts

    /** Get the list of prompts */
    public abstract getPrompts(projectId: number): Promise<PromptDTO[]>;

    /** Add a prompt to the project */
    public abstract addPrompt(entry: Omit<PromptDTO, "id">): Promise<void>;

    /** Toggle prompt active state */
    public abstract setPromptActive(id: number, active: boolean): Promise<void>;

    //#endregion

    //#region Pictures

    /** Get all pictures for a project */
    public abstract getPictures(projectId: number, promptId?: number): Promise<PictureDTO[]>;

    /** Mark picture as accepted or rejected */
    public abstract setPictureStatus(id: number, status: ComputationStatus.ACCEPTED | ComputationStatus.REJECTED): Promise<void>;

    //#endregion
}
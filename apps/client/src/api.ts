import { AbstractDataWrapper } from "@eurekai/shared/src/data";
import { ProjectDTO, PromptDTO, PictureDTO, ComputationStatus } from "@eurekai/shared/src/types";

export class API extends AbstractDataWrapper {

    constructor() {
        super();
    }

    //#region Projects

    /** @inheritdoc */
    public override getProjects(): Promise<ProjectDTO[]> {
        return this._apiCall<ProjectDTO[]>("getProjects");
    }

    public override getProject(id: number): Promise<ProjectDTO | null> {
        throw new Error("Method not implemented.");
    }

    public override addProject(name: string): Promise<number> {
        return this._apiCall<number>("addProject", name);
    }

    //#endregion

    //#region Prompts

    public override getPrompts(projectId: number): Promise<PromptDTO[]> {
        throw new Error("Method not implemented.");
    }

    public override getPrompt(id: number): Promise<PromptDTO> {
        throw new Error("Method not implemented.");
    }

    public override addPrompt(entry: Omit<PromptDTO, "id">): Promise<void> {
        throw new Error("Method not implemented.");
    }

    public override setPromptActive(id: number, active: boolean): Promise<void> {
        throw new Error("Method not implemented.");
    }

    //#endregion

    //#region Pictures

    public override getPictures(projectId: number, promptId?: number | undefined): Promise<PictureDTO[]> {
        throw new Error("Method not implemented.");
    }

    public override setPictureStatus(id: number, status: ComputationStatus.ACCEPTED | ComputationStatus.REJECTED): Promise<void> {
        throw new Error("Method not implemented.");
    }

    //#endregion

    //#region Attachments

    public override getAttachment(id: number): Promise<string> {
        throw new Error("Method not implemented.");
    }

    //#endregion

    //#region Tools

    protected async _apiCall<T>(method: string, ...args: any[]): Promise<T> {
        const response = await fetch(`/api/${method}`, {
            method: "POST",
            body: JSON.stringify(args),
            headers: {
                'Content-Type': 'application/json',
            }
        });
        if (!response.ok) {
            throw new Error(`API call failed: ${response.status} ${response.statusText}`);
        } else {
            const data = await response.json();
            return data as T;
        }
    }

    //#endregion
}
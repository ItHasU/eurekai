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

    /** @inheritdoc */
    public override getPrompts(projectId: number): Promise<PromptDTO[]> {
        return this._apiCall<PromptDTO[]>("getPrompts", projectId);
    }

    public override getPrompt(id: number): Promise<PromptDTO> {
        throw new Error("Method not implemented.");
    }

    /** @inheritdoc */
    public override addPrompt(entry: Omit<PromptDTO, "id">): Promise<void> {
        return this._apiCall<void>("addPrompt", entry);
    }

    /** @inheritdoc */
    public override setPromptActive(id: number, active: boolean): Promise<void> {
        return this._apiCall<void>("setPromptActive", id, active);
    }

    //#endregion

    //#region Pictures

    public override getPictures(projectId: number, promptId?: number | undefined): Promise<PictureDTO[]> {
        return this._apiCall<PictureDTO[]>("getPictures", projectId, promptId);
    }

    public override setPictureStatus(id: number, status: ComputationStatus.ACCEPTED | ComputationStatus.REJECTED): Promise<void> {
        return this._apiCall<void>("setPictureStatus", id, status);
    }

    //#endregion

    //#region Attachments

    public override getAttachment(id: number): Promise<string> {
        return this._apiCall<string>("getAttachment", id);
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
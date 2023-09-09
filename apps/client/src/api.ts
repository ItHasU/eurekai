import { AbstractDataWrapper, Notification, SDModels } from "@eurekai/shared/src/data";
import { ProjectDTO, PromptDTO, PictureDTO, ComputationStatus, ProjectWithStats, BooleanEnum } from "@eurekai/shared/src/types";

export type NotificationCabllback = (api: API, notification: Notification) => void;

export class API extends AbstractDataWrapper {

    /** Callback to be executed on new notification */
    public notificationCallback?: NotificationCabllback;

    constructor() {
        super();
        this._pollNoritications();
    }

    //#region SD Models

    public override getModels(): Promise<SDModels[]> {
        return this._apiCall<SDModels[]>("getModels");
    }

    public override getModel(): Promise<string | null> {
        return this._apiCall<string | null>("getModel");
    }

    public override setModel(model: string): Promise<void> {
        return this._apiCall<void>("setModel", model);
    }

    //#endregion

    //#region Projects

    /** @inheritdoc */
    public override getProjects(): Promise<ProjectDTO[]> {
        return this._apiCall<ProjectDTO[]>("getProjects");
    }

    /** @inheritdoc */
    public override getProjectsWithStats(): Promise<ProjectWithStats[]> {
        return this._apiCall<ProjectWithStats[]>("getProjectsWithStats");
    }

    /** @inheritdoc */
    public override getProject(id: number): Promise<ProjectDTO | null> {
        throw new Error("Method not implemented.");
    }

    /** @inheritdoc */
    public override addProject(name: string, width: number, height: number): Promise<number> {
        return this._apiCall<number>("addProject", name, width, height);
    }

    /** @inheritdoc */
    public override updateProject(projectId: number, name: string, width: number, height: number, scale: number, lockable: BooleanEnum): Promise<void> {
        return this._apiCall<void>("updateProject", projectId, name, width, height, scale, lockable);
    }

    /** @inheritdoc */
    public override deleteProject(projectId: number): Promise<void> {
        return this._apiCall<void>("deleteProject", projectId);
    }

    /** @inheritdoc */
    public override setProjectFeaturedImage(projectId: number, attachmentId: number | null): Promise<void> {
        return this._apiCall<void>("setProjectFeaturedImage", projectId, attachmentId);
    }

    /** @inheritdoc */
    public override cleanProject(id: number): Promise<void> {
        return this._apiCall<void>("cleanProject", id);
    }

    /** @inheritdoc */
    public override setProjectPinned(projectId: number, pinned: boolean): Promise<void> {
        return this._apiCall<void>("setProjectPinned", projectId, pinned);
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

    /** @inheritdoc */
    public override movePrompt(id: number, projectId: number | null): Promise<void> {
        return this._apiCall<void>("movePrompt", id, projectId);
    }

    //#endregion

    //#region Seeds

    public override getSeeds(projectId: number): Promise<number[]> {
        return this._apiCall<number[]>("getSeeds", projectId);
    }

    public override setSeedPreferred(projectId: number, seed: number, preferred: boolean): Promise<void> {
        return this._apiCall<void>("setSeedPreferred", projectId, seed, preferred);
    }

    //#endregion

    //#region Pictures

    public override getPictures(projectId: number, promptId?: number | undefined): Promise<PictureDTO[]> {
        return this._apiCall<PictureDTO[]>("getPictures", projectId, promptId);
    }

    public override setPictureStatus(id: number, status: ComputationStatus.ACCEPTED | ComputationStatus.REJECTED): Promise<void> {
        return this._apiCall<void>("setPictureStatus", id, status);
    }

    public override setPictureHighres(id: number, highres: boolean): Promise<void> {
        return this._apiCall<void>("setPictureHighres", id, highres);
    }

    public override deletePictureHighres(id: number): Promise<void> {
        return this._apiCall<void>("deletePictureHighres", id);
    }

    //#endregion

    //#region Attachments

    public override getAttachment(id: number): Promise<string> {
        return this._apiCall<string>("getAttachment", id);
    }

    //#endregion

    //#region System

    /** @inheritdoc */
    public override vacuum(): Promise<void> {
        return this._apiCall<void>("vacuum");
    }

    /** @inheritdoc */
    public override fixHighres(): Promise<void> {
        return this._apiCall<void>("fixHighres");
    }

    //#endregion

    //#region Notifications

    protected _pollNoritications(): void {
        this.pollNextNotification().then(notification => {
            if (this.notificationCallback) {
                this.notificationCallback(this, notification);
            }
        }).catch(err => {
            // We don't care about errors here
            console.warn(err);
            return new Promise<void>(resolve => setTimeout(resolve, 1000));
        }).then(this._pollNoritications.bind(this)); // Start again
    }

    public override pollNextNotification(): Promise<Notification> {
        return this._apiCall<Notification>("pollNextNotification");
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
import { AttachmentDTO, BooleanEnum, ProjectWithStats, Txt2ImgOptions, eq, set } from "@eurekai/shared/src/types";
import { ProjectDTO, Tables, TableName, f, t, PromptDTO, PictureDTO, ComputationStatus } from "@eurekai/shared/src/types";
import { AbstractDataWrapper, Notification, SDModel } from "@eurekai/shared/src/data";
import sqlite from "better-sqlite3";
import { AbstractAPI } from "./diffusers/abstract.api";

export interface PendingPrompt extends PromptDTO {
    pendingPictureCount: number;
}

const DEFAULT_PARAMETERS: Txt2ImgOptions = {
    prompt: "",
    negative_prompt: "",
    seed: -1,

    width: 512,
    height: 512,
    steps: 20,
    sampler_name: "DDIM",

    n_iter: 1,
    batch_size: 1,
    cfg_scale: 7,

    save_images: false
};

type SQLValue = number | string | null;

export class DatabaseWrapper extends AbstractDataWrapper {
    protected _db: sqlite.Database;

    constructor(dbPath: string) {
        super();
        this._db = new sqlite(dbPath);
    }

    //#region General management ----------------------------------------------

    public async initIfNeeded(): Promise<void> {
        await this._initTable("projects", {
            "id": "INTEGER PRIMARY KEY AUTOINCREMENT",
            "name": "TEXT",
            "featuredAttachmentId": "INTEGER NULL",
            "lockable": "INTEGER DEFAULT FALSE", // FALSE = 0
            "pinned": "INTEGER DEFAULT FALSE"    // FALSE = 0
        });
        await this._initTable("prompts", {
            "id": "INTEGER PRIMARY KEY AUTOINCREMENT",
            "projectId": "INTEGER",
            "orderIndex": "INTEGER",
            "active": "BOOLEAN",
            "width": "INTEGER DEFAULT 512",
            "height": "INTEGER DEFAULT 512",
            "model": "TEXT",
            "prompt": "TEXT",
            "negative_prompt": "TEXT NULL",
            "bufferSize": "INTEGER",
        });
        await this._initTable("seeds", {
            "projectId": "INTEGER",
            "seed": "INTEGER"
        });
        await this._initTable("pictures", {
            "id": "INTEGER PRIMARY KEY AUTOINCREMENT",
            "promptId": "INTEGER",
            "seed": "INTEGER DEFAULT -1",
            "status": "INTEGER",
            "attachmentId": "INTEGER NULL",
            "highresStatus": "INTEGER DEFAULT 0",
            "highresAttachmentId": "INTEGER NULL"
        });
        await this._initTable("attachments", {
            "id": "INTEGER PRIMARY KEY AUTOINCREMENT",
            "data": "TEXT"
        });
    }

    public async close(): Promise<void> {
        this._db.close();
        return Promise.resolve();
    }

    /** @inheritdoc */
    public override async vacuum(): Promise<void> {
        await this._purgeAttachments();
        await this._run("VACUUM");
    }

    public override fixHighres(): Promise<void> {
        return this._run(`
            UPDATE ${t("pictures")} SET ${set("pictures", "highresStatus", ComputationStatus.ERROR, false)}, ${set("pictures", "highresAttachmentId", undefined, false)} = NULL WHERE id IN (
                SELECT ${f("pictures", "id")} FROM ${t("pictures")}
                    LEFT JOIN ${t("attachments")} ON ${f("pictures", "highresAttachmentId")}=${f("attachments", "id")}
                    WHERE ${f("pictures", "highresAttachmentId")} IS NOT NULL AND ${f("attachments", "id")} IS NULL
            )`);
    }

    /** Fix pictures marked as computing on startup */
    public async fixComputingAtStart(): Promise<void> {
        await this._run(`UPDATE ${t("pictures")} SET ${set("pictures", "status", ComputationStatus.ERROR, false)} WHERE ${eq("pictures", "status", ComputationStatus.COMPUTING, false)}`);
        await this._run(`UPDATE ${t("pictures")} SET ${set("pictures", "highresStatus", ComputationStatus.ERROR, false)} WHERE ${eq("pictures", "highresStatus", ComputationStatus.COMPUTING, false)}`);
    }

    //#endregion

    //#region SD Models management --------------------------------------------

    protected _models: Map<string, AbstractAPI> = new Map();
    protected _selectedModel: string | null = null;

    public clearModels(): void {
        this._models.clear();
        this._selectedModel = null;
    }

    public registerModel(title: string, api: AbstractAPI): void {
        this._models.set(title, api);
        if (this._selectedModel == null) {
            this._selectedModel = title;
        }
    }

    public async getModels(): Promise<SDModel[]> {
        return [...this._models.values()].map(api => {
            const fakeModel: SDModel = {
                title: api.getTitle(),
                resolutions: [],
                styles: []
            };
            return fakeModel;
        });
    }

    public override getModel(): Promise<string | null> {
        return Promise.resolve(this._selectedModel);
    }

    public setModel(model: string): Promise<void> {
        this._selectedModel = model;
        return Promise.resolve();
    }

    public getSelectedDiffuser(): AbstractAPI {
        if (this._selectedModel == null) {
            throw new Error("No diffuser available");
        }
        const diffuser = this._models.get(this._selectedModel);
        if (diffuser == null) {
            throw new Error(`Model ${this._selectedModel} not found`);
        }
        return diffuser;
    }

    //#endregion

    //#region Projects management ---------------------------------------------

    /** @inheritdoc */
    public override async getProjects(): Promise<ProjectDTO[]> {
        return this._all<ProjectDTO>(`SELECT * FROM ${t("projects")}`);
    }

    /** @inheritdoc */
    public override async getProject(id: number): Promise<ProjectDTO | null> {
        return this._get<ProjectDTO>(`SELECT * FROM ${t("projects")} WHERE ${f("projects", "id")} = ?`, [id]);
    }

    /** @inheritdoc */
    public override getProjectsWithStats(): Promise<ProjectWithStats[]> {
        const picturesWith = <P extends keyof PictureDTO>(property: P, value: PictureDTO[P], quoted: number extends PictureDTO[P] ? false : true): string => {
            return `(SELECT COUNT(${f("pictures", "id")}) 
                        FROM ${t("prompts")} 
                        JOIN ${t("pictures")} ON ${f("pictures", "promptId")} = ${f("prompts", "id")} 
                        WHERE ${eq("pictures", property, value, quoted)} AND ${f("prompts", "projectId")} = ${f("projects", "id")})`;
        }
        const query = `
            SELECT
                ${t("projects")}.*,
                (SELECT COUNT(id) FROM prompts WHERE projectId = projects.id) prompts,
                (SELECT COUNT(id) FROM prompts WHERE projectId = projects.id AND active=1) activePrompts,
                ${picturesWith("status", ComputationStatus.DONE, false)} doneCount,
                ${picturesWith("status", ComputationStatus.ACCEPTED, false)} acceptedCount,
                ${picturesWith("status", ComputationStatus.REJECTED, false)} rejectedCount,
                ${picturesWith("highresStatus", ComputationStatus.DONE, false)} highresCount,
                ${picturesWith("highresStatus", ComputationStatus.COMPUTING, false)} highresPendingCount
            FROM ${t("projects")}`;
        return this._all<ProjectWithStats>(query, undefined);
    }

    /** @inheritdoc */
    public override addProject(name: string, width: number, height: number): Promise<number> {
        return this._insert(`INSERT INTO ${t("projects")} (name, width, height, scale) VALUES (?, ?, ?, 2)`, [name, width ?? 512, height ?? 512]);
    }

    /** @inheritdoc */
    public override updateProject(projectId: number, name: string, width: number, height: number, scale: number, lockable: BooleanEnum): Promise<void> {
        return this._run(`UPDATE ${t("projects")} SET name = ?, width = ?, height = ?, scale = ?, lockable = ? WHERE id = ?`, [name, width, height, scale, lockable, projectId]);
    }

    /** @inheritdoc */
    public override async deleteProject(projectId: number): Promise<void> {
        // -- Delete project's pictures --
        await this._run(`DELETE FROM ${t("pictures")} WHERE ${f("pictures", "promptId")} IN (SELECT ${f("prompts", "id")} FROM ${t("prompts")} WHERE ${f("prompts", "projectId")} = ?)`, [projectId]);
        // -- Delete project's prompts --
        await this._run(`DELETE FROM ${t("prompts")} WHERE projectId = ?`, [projectId]);
        // -- Delete the project --
        await this._run(`DELETE FROM ${t("projects")} WHERE id = ?`, [projectId]);
    }

    /** @inheritdoc */
    public override async setProjectFeaturedImage(projectId: number, attachmentId: number | null): Promise<void> {
        await this._run(`UPDATE ${t("projects")} SET ${f("projects", "featuredAttachmentId")} = ? WHERE id = ?`, [attachmentId, projectId]);
    }

    /** @inheritdoc */
    public override async cleanProject(id: number): Promise<void> {
        // Stop all prompts
        await this._run(`UPDATE ${t("prompts")} SET ${f("prompts", "active")}=false WHERE ${f("prompts", "projectId")} = ?;`, [id]);
        // Remove all rejected pictures
        await this._run(`DELETE FROM ${t("pictures")} WHERE projectId=? AND computed=${ComputationStatus.REJECTED};`, [id]);
    }

    /** @inheritdoc */
    public override async setProjectPinned(projectId: number, pinned: boolean): Promise<void> {
        // Stop all prompts
        await this._run(`UPDATE ${t("projects")} SET ${set("projects", "pinned", pinned ? BooleanEnum.TRUE : BooleanEnum.FALSE, false)} WHERE ${f("projects", "id")}=?;`, [projectId]);
    }

    /** Clean attachments that are not referenced anymore */
    protected _purgeAttachments(): Promise<void> {
        // Purge attachments not linked to pictures anymore
        return this._run(`DELETE FROM ${t("attachments")} WHERE id IN (
            SELECT attachments.id FROM attachments 
            LEFT JOIN pictures ON attachments.id=pictures.attachmentId OR attachments.id=pictures.highresAttachmentId
            WHERE pictures.id IS NULL
        );`);
    }

    //#endregion

    //#region Pompts management -----------------------------------------------

    /** @inheritdoc */
    public override getPrompts(projectId: number): Promise<PromptDTO[]> {
        return this._all<PromptDTO>(`SELECT * FROM ${t("prompts")} WHERE projectId = ? ORDER BY orderIndex DESC`, [projectId]);
    }

    /** @inheritdoc */
    public override getPrompt(id: number): Promise<PromptDTO> {
        return this._get<PromptDTO>(`SELECT * FROM ${t("prompts")} WHERE id = ?`, [id]).then(function (row) {
            if (!row) throw `Prompt ${id} not found`;
            return row;
        });
    }

    /** Get a list of active prompts with statistics on related pictures */
    public async getPendingPrompts(): Promise<PendingPrompt[]> {
        return this._all<PendingPrompt>(`SELECT ${t("prompts")}.*, COUNT(DISTINCT ${f("pictures", "id")}) AS pendingPictureCount
            FROM ${t("prompts")}
            LEFT JOIN ${t("pictures")} ON ${f("pictures", "promptId")} = ${f("prompts", "id")} AND ${f("pictures", "status")} <= ${ComputationStatus.DONE}
            WHERE ${eq("prompts", "active", true, true)}
            GROUP BY ${f("prompts", "id")}
            HAVING (${eq("prompts", "bufferSize", 0, false)} OR pendingPictureCount < ${f("prompts", "bufferSize")})
            ORDER BY pendingPictureCount`);
    }

    /** @inheritdoc */
    public override async addPrompt(entry: Omit<PromptDTO, "id" | "orderIndex">): Promise<void> {
        const nextIndex = await this._getPromptNextOrderIndex(entry.projectId);
        return this._run(
            `INSERT INTO ${t("prompts")} (projectId, orderIndex, active, prompt, negative_prompt, bufferSize, acceptedTarget) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                entry.projectId,
                nextIndex,
                entry.active ? 1 : 0,
                entry.prompt,
                entry.negative_prompt ?? null,
                entry.bufferSize
            ]);
    }

    protected async _getPromptNextOrderIndex(projectId: number): Promise<number> {
        return this._get<{ maxIndex: number }>(`SELECT MAX(orderIndex) AS maxIndex FROM ${t("prompts")} WHERE projectId = ? GROUP BY projectId`, [projectId]).then(function (res) {
            return (res?.maxIndex ?? 0) + 1;
        });
    }

    /** @inheritdoc */
    public override async setPromptActive(id: number, active: boolean): Promise<void> {
        return this._run(`UPDATE ${t("prompts")} SET active = ? WHERE id = ?`, [
            active ? 1 : 0,
            id
        ]);
    }

    /** @inheritdoc */
    public override async movePrompt(id: number, projectId: number | null): Promise<void> {
        if (projectId == null) {
            // First, delete the prompt
            await this._run(`DELETE FROM ${t("prompts")} WHERE id = ?`, [id]);
            // Then, delete the pictures as promptId is duplicated
            await this._run(`DELETE FROM ${t("pictures")} WHERE promptId = ?`, [id]);
        } else {
            // Fist, we update the prompt itself
            await this._run(`UPDATE ${t("prompts")} SET projectId = ? WHERE id = ?`, [projectId, id]);
            // Then, we update the pictures as projectId is duplicated
            await this._run(`UPDATE ${t("pictures")} SET projectId = ? WHERE promptId = ?`, [projectId, id]);
        }
    }

    //#endregion

    //#region Seeds management ------------------------------------------------

    /** @inheritdoc */
    public override getSeeds(projectId: number): Promise<number[]> {
        return this._all<any>(`SELECT seed FROM ${t("seeds")} WHERE projectId = ?`, [projectId]).then(function (rows: any[]) {
            return rows.map((row: any) => row.seed);
        });
    }

    /** @inheritdoc */
    public override async setSeedPreferred(projectId: number, seed: number, preferred: boolean): Promise<void> {
        // Clean preferred seeds
        await this._run('DELETE FROM seeds WHERE projectId = ? AND seed = ?', [projectId, seed]);
        // Add preferred seed if needed
        if (preferred) {
            await this._insert('INSERT INTO seeds (projectId, seed) VALUES (?, ?)', [projectId, seed]);
        }
    }

    /** Get one preferred seed that is not generated yet for the given prompt */
    public async getSeedPending(promptId: number): Promise<number | null> {
        return this._get<{ seed: number }>(`
                SELECT seeds.seed FROM prompts 
                JOIN seeds ON seeds.projectId = prompts.projectId 
                WHERE 
                    prompts.id = ? AND 
                    seeds.seed NOT IN (
                        SELECT pictures.seed AS seed FROM pictures 
                        WHERE pictures.promptId = ?
                    );
            `, [promptId, promptId])
            .then(function (row) {
                return row?.seed ?? null;
            });
    }

    //#endregion

    //#region Pictures management ---------------------------------------------

    /** @inheritdoc */
    public override async getPictures(projectId: number, promptId?: number): Promise<PictureDTO[]> {
        let query = `SELECT * FROM ${t("pictures")} WHERE projectId = ?`;
        const params = [projectId];
        if (promptId != null) {
            query += " AND promptId = ?";
            params.push(promptId);
        }
        return this._all<PictureDTO>(query, params).then(function (rows) {
            return rows.map((row: any) => {
                row.options = JSON.parse(row.options);
                return row;
            });
        });
    }

    /** Create a picture from  */
    public async createPictureFromPrompt(prompt: PromptDTO, seed?: number): Promise<PictureDTO> {
        const project = await this.getProject(prompt.projectId);
        if (!project) {
            throw new Error(`Project ${prompt.projectId} not found`);
        }

        seed = seed ?? (Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
        const picture: Omit<PictureDTO, "id" | "status"> = {
            promptId: prompt.id,
            seed,
            highresStatus: ComputationStatus.NONE
        };
        return this.addPicture(picture);
    }

    /** Save a picture in pending state */
    public async addPicture(entry: Omit<PictureDTO, "id" | "status" | "attachmentId">): Promise<PictureDTO> {
        const id = await this._insert(
            `INSERT INTO ${t("pictures")} (promptId, seed, status, attachmentId) VALUES (?, ?, ?, ?, ?)`,
            [
                entry.promptId,
                entry.seed,
                ComputationStatus.PENDING,
                null
            ]
        );
        return {
            ...entry,
            id,
            status: ComputationStatus.PENDING
        };
    }

    /** Save picture data as an attachment and mark image as done */
    public async setPictureData(id: number, data: string): Promise<void> {
        // Save data as attachment
        const attachmentId = await this.addAttachment(data);

        // Update picture
        return this._run(`UPDATE ${t("pictures")} SET attachmentId = ?, computed = ? WHERE id = ?`, [attachmentId, ComputationStatus.DONE, id]);
    }

    /** Save picture data as an attachment and mark image as done */
    public async setPictureHighresData(id: number, data: string): Promise<void> {
        // Save data as attachment
        const attachmentId = await this.addAttachment(data);

        // Update picture
        return this._run(`UPDATE ${t("pictures")} SET highresAttachmentId = ?, highres = ? WHERE id = ?`, [attachmentId, ComputationStatus.DONE, id]);
    }

    /** @inheritdoc */
    public async setPictureStatus(id: number, status: ComputationStatus.ACCEPTED | ComputationStatus.REJECTED | ComputationStatus.ERROR): Promise<void> {
        return this._run(`UPDATE ${t("pictures")} SET computed = ? WHERE id = ?`, [status, id]);
    }

    public override setPictureHighres(id: number, highres: boolean): Promise<void> {
        return this._run(`UPDATE ${t("pictures")} SET highres = ? WHERE id = ? AND (highres = ? OR highres > ${ComputationStatus.DONE})`, [
            highres ? ComputationStatus.PENDING : ComputationStatus.NONE, // Status to assign
            id,
            highres ? ComputationStatus.NONE : ComputationStatus.PENDING // Only toggle state if computation is not started yet
        ]);
    }

    public setPictureHighresStatus(id: number, status: ComputationStatus): Promise<void> {
        return this._run(`UPDATE ${t("pictures")} SET highres = ? WHERE id = ?`, [
            status, // Status to assign
            id
        ]);
    }

    public getPicturesHighresPending(): Promise<PictureDTO[]> {
        return this._all<PictureDTO>(`SELECT * FROM ${t("pictures")} WHERE ${f("pictures", "highresStatus")} = ?`, [ComputationStatus.PENDING]).then(function (rows) {
            return rows.map((row: any) => {
                row.options = JSON.parse(row.options);
                return row;
            });
        });
    }

    public override async deletePictureHighres(id: number): Promise<void> {
        await this._run(`UPDATE ${t("pictures")} SET highres = ${ComputationStatus.REJECTED} WHERE id = ? AND highres >= ${ComputationStatus.DONE}`, [id]);
    }

    //#endregion

    //#region Attachments management ------------------------------------------

    /** Get all attachments */
    public async getAttachments(): Promise<AttachmentDTO[]> {
        return this._all<AttachmentDTO>(`SELECT * FROM ${t("attachments")}`, undefined);
    }

    /** Create an attachment and return its id */
    public async addAttachment(data: string): Promise<number> {
        return this._insert(`INSERT INTO ${t("attachments")} (data) VALUES (?)`, [data]);
    }

    public async getAttachment(id: number): Promise<string> {
        return this._get<AttachmentDTO>(`SELECT data FROM ${t("attachments")} WHERE id = ?`, [id]).then(function (row) {
            if (!row) throw new Error(`Attachment ${id} not found`);
            return row.data;
        });
    }

    //#endregion

    //#region Tools -----------------------------------------------------------

    protected async _initTable<TN extends TableName, T extends Tables[TN] = Tables[TN]>(tableName: TN, fieldTypes: { [fields in keyof Required<T>]: string }): Promise<void> {
        await this._createTableIfNeeded(tableName, fieldTypes);
        for (const fieldName in fieldTypes) {
            this._createFieldIfNeeded(tableName, fieldName as keyof Required<T>, fieldTypes[fieldName]);
        }
    }

    protected _createTableIfNeeded<TN extends TableName, T extends Tables[TN] = Tables[TN]>(tableName: TN, fieldTypes: { [fields in keyof Required<T>]: string }): Promise<void> {
        return this._run(`CREATE TABLE IF NOT EXISTS ${tableName} (${Object.entries(fieldTypes).map(([fieldName, fieldType]) => `'${fieldName}' ${fieldType}`).join(", ")})`, undefined);
    }

    /** @returns true if column was created */
    protected _createFieldIfNeeded<TN extends TableName, T extends Tables[TN] = Tables[TN]>(tableName: TN, fieldName: keyof Required<T>, fieldType: string): Promise<boolean> {
        return this._run(`ALTER TABLE ${tableName} ADD COLUMN ${fieldName as string} ${fieldType}`, undefined).catch(() => false).then(() => true);
    }

    //#endregion

    //#region Tools -----------------------------------------------------------

    /** Get rows */
    protected _all<Row>(query: string, params: SQLValue[] = []): Promise<Row[]> {
        try {
            const rows = this._db.prepare(query).all(...params) as Row[];
            return Promise.resolve(rows);
        } catch (e) {
            console.log(query, params);
            return Promise.reject(e);
        }
    }

    protected _get<Row>(query: string, params: SQLValue[] = []): Promise<Row | null> {
        try {
            const row = this._db.prepare(query).get(...params) as Row | undefined;
            return Promise.resolve(row ?? null);
        } catch (e) {
            console.log(query, params);
            return Promise.reject(e);
        }
    }

    protected async _insert(query: string, params: SQLValue[] = []): Promise<number> {
        try {
            await this._run(query, params);
            return (await this._get<{ id: number }>("SELECT last_insert_rowid() AS id", []))?.id ?? -1;
        } catch (e) {
            return Promise.reject(e);
        }
    }

    protected _run(query: string, params: SQLValue[] = []): Promise<void> {
        try {
            this._db.prepare(query).run(...params);
            return Promise.resolve();
        } catch (e) {
            console.log(query, params);
            return Promise.reject(e);
        }
    }

    //#endregion

    //#region Notifications ---------------------------------------------------

    protected _pendingNotificationResolves: ((notification: Notification) => void)[] = [];

    /** @inheritdoc */
    public override pollNextNotification(): Promise<Notification> {
        return new Promise(resolve => {
            this._pendingNotificationResolves.push(resolve);
        });
    }

    /** Push a notification to the stack */
    public pushNotification(notification: Notification): void {
        const promises = this._pendingNotificationResolves;
        this._pendingNotificationResolves = [];

        for (const p of promises) {
            p(notification);
        }
    }

    //#endregion

}
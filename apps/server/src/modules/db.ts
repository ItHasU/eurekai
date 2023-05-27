import { AttachmentDTO, HighresStatus, ProjectWithStats, Txt2ImgOptions } from "@eurekai/shared/src/types";
import { ProjectDTO, Tables, TableName, t, PromptDTO, PictureDTO, ComputationStatus } from "@eurekai/shared/src/types";
import { AbstractDataWrapper, SDModels } from "@eurekai/shared/src/data";
import sqlite3 from "sqlite3";
import { getModel, getModels, setModel } from "./api";

export interface PendingPrompt extends PromptDTO {
    pendingPictureCount: number;
    acceptedPictureCount: number;
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

    save_images: true
};

export class DatabaseWrapper extends AbstractDataWrapper {
    protected _db: sqlite3.Database;

    constructor(protected _apiURL: string, dbPath: string) {
        super();
        this._db = new sqlite3.Database(dbPath);
    }

    //#region General management ----------------------------------------------

    public async initIfNeeded(): Promise<void> {
        await this._initTable("projects", {
            "id": "INTEGER PRIMARY KEY AUTOINCREMENT",
            "name": "TEXT",
            "width": "INTEGER DEFAULT 512",
            "height": "INTEGER DEFAULT 512",
            "scale": "INTEGER DEFAULT 2"
        });
        await this._initTable("prompts", {
            "id": "INTEGER PRIMARY KEY AUTOINCREMENT",
            "projectId": "INTEGER",
            "orderIndex": "INTEGER",
            "active": "BOOLEAN",
            "prompt": "TEXT",
            "negative_prompt": "TEXT NULL",
            "bufferSize": "INTEGER",
            "acceptedTarget": "INTEGER"
        });
        await this._initTable("seeds", {
            "projectId": "INTEGER",
            "seed": "INTEGER"
        });
        await this._initTable("pictures", {
            "id": "INTEGER PRIMARY KEY AUTOINCREMENT",
            "projectId": "INTEGER",
            "promptId": "INTEGER",
            "options": "TEXT", // JSON
            "createdAt": "DATE",
            "computed": "INTEGER",
            "highres": "INTEGER DEFAULT 0",
            "attachmentId": "INTEGER NULL",
            "highresAttachmentId": "INTEGER NULL"
        });
        await this._initTable("attachments", {
            "id": "INTEGER PRIMARY KEY AUTOINCREMENT",
            "data": "TEXT"
        });
    }

    public async close(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._db.close((err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    /** @inheritdoc */
    public override vacuum(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._db.run("VACUUM", (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    public override fixHighres(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._db.run(`
            UPDATE ${t("pictures")} SET highres = ${HighresStatus.ERROR}, highresAttachmentId = NULL WHERE id IN (
                SELECT pictures.id FROM pictures 
                    LEFT JOIN attachments ON pictures.highresAttachmentId=attachments.id 
                    WHERE pictures.highresAttachmentId IS NOT NULL AND attachments.id IS NULL
            )`, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    //#endregion

    //#region SD Models management --------------------------------------------

    public async getModels(): Promise<SDModels[]> {
        return getModels(this._apiURL);
    }

    public override getModel(): Promise<string | null> {
        return getModel(this._apiURL);
    }

    public async setModel(model: string): Promise<void> {
        return setModel(this._apiURL, model);
    }

    //#endregion

    //#region Projects management ---------------------------------------------

    /** @inheritdoc */
    public override async getProjects(): Promise<ProjectDTO[]> {
        return new Promise<ProjectDTO[]>((resolve, reject) => {
            this._db.all(`SELECT * FROM ${t("projects")}`, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows as ProjectDTO[]);
                }
            });
        });
    }

    /** @inheritdoc */
    public override async getProject(id: number): Promise<ProjectDTO | null> {
        return new Promise<ProjectDTO | null>((resolve, reject) => {
            this._db.get(`SELECT * FROM ${t("projects")} WHERE id = ?`, [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row as ProjectDTO | null);
                }
            });
        });
    }

    /** @inheritdoc */
    public override getProjectsWithStats(): Promise<ProjectWithStats[]> {
        return new Promise<ProjectWithStats[]>((resolve, reject) => {
            const query = `
                SELECT
                    ${t("projects")}.*,
                    (SELECT COUNT(id) FROM prompts WHERE projectId = projects.id) prompts,
                    (SELECT COUNT(id) FROM pictures WHERE computed=${ComputationStatus.DONE} AND projectId = projects.id) doneCount,
                    (SELECT COUNT(id) FROM pictures WHERE computed=${ComputationStatus.ACCEPTED} AND projectId = projects.id) acceptedCount,
                    (SELECT COUNT(id) FROM pictures WHERE computed=${ComputationStatus.REJECTED} AND projectId = projects.id) rejectedCount,
                    (SELECT COUNT(id) FROM pictures WHERE highres=${HighresStatus.DONE} AND projectId = projects.id) highresCount
                FROM ${t("projects")}
            `;
            this._db.all(query, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows as ProjectWithStats[]);
                }
            });
        });
    }

    /** @inheritdoc */
    public override addProject(name: string, width: number, height: number): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            this._db.run(`INSERT INTO ${t("projects")} (name, width, height, scale) VALUES (?, ?, ?, 2)`, [name, width ?? 512, height ?? 512], function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    /** @inheritdoc */
    public override updateProject(projectId: number, name: string, width: number, height: number, scale: number): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._db.run(`UPDATE ${t("projects")} SET name = ?, width = ?, height = ?, scale = ? WHERE id = ?`, [name, width, height, scale, projectId], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    /** @inheritdoc */
    public override async deleteProject(projectId: number): Promise<void> {
        // -- Delete project's pictures --
        await new Promise<void>((resolve, reject) => {
            this._db.run(`DELETE FROM ${t("pictures")} WHERE projectId = ?`, [projectId], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
        // -- Delete project's prompts --
        await new Promise<void>((resolve, reject) => {
            this._db.run(`DELETE FROM ${t("prompts")} WHERE projectId = ?`, [projectId], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
        // -- Delete the project --
        await new Promise<void>((resolve, reject) => {
            this._db.run(`DELETE FROM ${t("projects")} WHERE id = ?`, [projectId], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
        await this._purgeAttachments();
    }

    /** @inheritdoc */
    public override async cleanProject(id: number): Promise<void> {
        // Stop all prompts
        await new Promise<void>((resolve, reject) => {
            this._db.run(`UPDATE ${t("prompts")} SET active=false WHERE projectId=?;`, [id], function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
        // Remove all rejected pictures
        await new Promise<void>((resolve, reject) => {
            this._db.run(`DELETE FROM ${t("pictures")} WHERE projectId=? AND computed=${ComputationStatus.REJECTED};`, [id], function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
        await this._purgeAttachments();
    }

    /** Clean attachments that are not referenced anymore */
    protected async _purgeAttachments(): Promise<void> {
        // Purge attachments not linked to pictures anymore
        await new Promise<void>((resolve, reject) => {
            this._db.run(`DELETE FROM ${t("attachments")} WHERE id IN (
                    SELECT attachments.id FROM attachments 
                    LEFT JOIN pictures ON attachments.id=pictures.attachmentId OR attachments.id=pictures.highresAttachmentId
                    WHERE pictures.id IS NULL
                );`, function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    //#endregion

    //#region Pompts management -----------------------------------------------

    /** @inheritdoc */
    public override async getPrompts(projectId: number): Promise<PromptDTO[]> {
        return new Promise<PromptDTO[]>((resolve, reject) => {
            this._db.all(`SELECT * FROM ${t("prompts")} WHERE projectId = ? ORDER BY orderIndex DESC`, [projectId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows as PromptDTO[]);
                }
            });
        });
    }

    /** @inheritdoc */
    public override async getPrompt(id: number): Promise<PromptDTO> {
        return new Promise<PromptDTO>((resolve, reject) => {
            this._db.get(`SELECT * FROM ${t("prompts")} WHERE id = ?`, [id], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows as PromptDTO);
                }
            });
        });
    }

    /** Get a list of active prompts with statistics on related pictures */
    public async getPendingPrompts(): Promise<PendingPrompt[]> {
        return new Promise<PendingPrompt[]>((resolve, reject) => {
            this._db.all(`SELECT p.*, COUNT(DISTINCT pic.id) AS pendingPictureCount, COUNT(DISTINCT pic2.id) AS acceptedPictureCount
                FROM ${t("prompts")} AS p 
                LEFT JOIN ${t("pictures")} AS pic ON p.id = pic.promptId AND pic.computed <= ${ComputationStatus.DONE}
                LEFT JOIN ${t("pictures")} AS pic2 ON pic2.promptId = p.id AND pic2.computed = ${ComputationStatus.ACCEPTED}
                WHERE p.active = 1
                GROUP BY p.id
                HAVING (p.bufferSize = 0 OR pendingPictureCount < p.bufferSize) AND (p.acceptedTarget = 0 OR acceptedPictureCount < p.acceptedTarget)
                ORDER BY pendingPictureCount`, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows as PendingPrompt[]);
                }
            });
        });
    }

    /** @inheritdoc */
    public override async addPrompt(entry: Omit<PromptDTO, "id" | "orderIndex">): Promise<void> {
        const nextIndex = await this._getPromptNextOrderIndex(entry.projectId);
        return new Promise<void>((resolve, reject) => {
            this._db.run(`INSERT INTO ${t("prompts")} (projectId, orderIndex, active, prompt, negative_prompt, bufferSize, acceptedTarget) VALUES (?, ?, ?, ?, ?, ?, ?)`, [entry.projectId, nextIndex, entry.active, entry.prompt, entry.negative_prompt, entry.bufferSize, entry.acceptedTarget], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    protected async _getPromptNextOrderIndex(projectId: number): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            this._db.get(`SELECT MAX(orderIndex) AS maxIndex FROM ${t("prompts")} WHERE projectId = ? GROUP BY projectId`, [projectId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(((row as { maxIndex: number })?.maxIndex ?? 0) + 1);
                }
            });
        });
    }

    /** @inheritdoc */
    public override async setPromptActive(id: number, active: boolean): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._db.run(`UPDATE ${t("prompts")} SET active = ? WHERE id = ?`, [active, id], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    //#endregion

    //#region Seeds management ------------------------------------------------

    /** @inheritdoc */
    public override getSeeds(projectId: number): Promise<number[]> {
        return new Promise<number[]>((resolve, reject) => {
            this._db.all(`SELECT seed FROM ${t("seeds")} WHERE projectId = ?`, [projectId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map((row: any) => row.seed));
                }
            });
        });
    }

    /** @inheritdoc */
    public override async setSeedPreferred(projectId: number, seed: number, preferred: boolean): Promise<void> {
        // Clean preferred seeds
        await new Promise<void>((resolve, reject) => {
            this._db.all('DELETE FROM seeds WHERE projectId = ? AND seed = ?', [projectId, seed], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
        // Add preferred seed if needed
        if (preferred) {
            await new Promise<void>((resolve, reject) => {
                this._db.all('INSERT INTO seeds (projectId, seed) VALUES (?, ?)', [projectId, seed], (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        }
    }

    /** Get one preferred seed that is not generated yet for the given prompt */
    public async getSeedPending(promptId: number): Promise<number | null> {
        return new Promise<number | null>((resolve, reject) => {
            this._db.get(`
                SELECT seeds.seed FROM prompts 
                JOIN seeds ON seeds.projectId = prompts.projectId 
                WHERE 
                    prompts.id = ? AND 
                    seeds.seed NOT IN (
                        SELECT pictures.options->>"$.seed" AS seed FROM pictures 
                        WHERE pictures.promptId = ?
                    );
            `, [promptId, promptId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve((row as { seed: number })?.seed ?? null);
                }
            });
        });
    }

    //#endregion

    //#region Pictures management ---------------------------------------------

    /** @inheritdoc */
    public override async getPictures(projectId: number, promptId?: number): Promise<PictureDTO[]> {
        return new Promise<PictureDTO[]>((resolve, reject) => {
            let query = `SELECT * FROM ${t("pictures")} WHERE projectId = ?`;
            const params = [projectId];
            if (promptId != null) {
                query += " AND promptId = ?";
                params.push(promptId);
            }
            this._db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    try {
                        resolve(rows.map((row: any) => {
                            row.options = JSON.parse(row.options);
                            return row;
                        }));
                    } catch (e) {
                        reject(e);
                    }
                }
            });
        });
    }

    /** Create a picture from  */
    public async createPictureFromPrompt(prompt: PromptDTO, seed?: number): Promise<PictureDTO> {
        const project = await this.getProject(prompt.projectId);
        if (!project) {
            throw new Error(`Project ${prompt.projectId} not found`);
        }

        const picture: Omit<PictureDTO, "id" | "computed"> = {
            projectId: prompt.projectId,
            promptId: prompt.id,
            createdAt: new Date().getTime(),
            highres: HighresStatus.NONE,
            options: {
                ...DEFAULT_PARAMETERS,
                width: project.width,
                height: project.height,
                prompt: prompt.prompt,
                negative_prompt: prompt.negative_prompt,
                seed: seed ?? (Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))
            }
        };
        return this.addPicture(picture);
    }

    /** Save a picture in pending state */
    public async addPicture(entry: Omit<PictureDTO, "id" | "computed">): Promise<PictureDTO> {
        return new Promise<PictureDTO>((resolve, reject) => {
            this._db.run(`INSERT INTO ${t("pictures")} (projectId, promptId, options, createdAt, computed, attachmentId) VALUES (?, ?, ?, ?, ?, ?)`, [entry.projectId, entry.promptId, JSON.stringify(entry.options), entry.createdAt, ComputationStatus.PENDING, entry.attachmentId], function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        ...entry,
                        id: this.lastID,
                        computed: ComputationStatus.PENDING
                    });
                }
            });
        });
    }

    /** Save picture data as an attachment and mark image as done */
    public async setPictureData(id: number, data: string): Promise<void> {
        // Save data as attachment
        const attachmentId = await this.addAttachment(data);

        // Update picture
        return new Promise<void>((resolve, reject) => {
            this._db.run(`UPDATE ${t("pictures")} SET attachmentId = ?, computed = ? WHERE id = ?`, [attachmentId, ComputationStatus.DONE, id], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    /** Save picture data as an attachment and mark image as done */
    public async setPictureHighresData(id: number, data: string): Promise<void> {
        // Save data as attachment
        const attachmentId = await this.addAttachment(data);

        // Update picture
        return new Promise<void>((resolve, reject) => {
            this._db.run(`UPDATE ${t("pictures")} SET highresAttachmentId = ?, highres = ? WHERE id = ?`, [attachmentId, HighresStatus.DONE, id], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    /** @inheritdoc */
    public async setPictureStatus(id: number, status: ComputationStatus.ACCEPTED | ComputationStatus.REJECTED | ComputationStatus.ERROR): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._db.run(`UPDATE ${t("pictures")} SET computed = ? WHERE id = ?`, [status, id], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    public override setPictureHighres(id: number, highres: boolean): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._db.run(`UPDATE ${t("pictures")} SET highres = ? WHERE id = ? AND (highres = ? OR highres > ${HighresStatus.DONE})`, [
                highres ? HighresStatus.PENDING : HighresStatus.NONE, // Status to assign
                id, 
                highres ? HighresStatus.NONE : HighresStatus.PENDING // Only toggle state if computation is not started yet
            ], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    public setPictureHighresStatus(id: number, status: HighresStatus): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._db.run(`UPDATE ${t("pictures")} SET highres = ? WHERE id = ?`, [
                status, // Status to assign
                id
            ], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    public getPicturesHighresPending(): Promise<PictureDTO[]> {
        return new Promise<PictureDTO[]>((resolve, reject) => {
            this._db.all(`SELECT * FROM ${t("pictures")} WHERE highres = ?`, [HighresStatus.PENDING], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows.map((row: any) => {
                        row.options = JSON.parse(row.options);
                        return row;
                    }));
                }
            });
        });
    }

    public override async deletePictureHighres(id: number): Promise<void> {
        await new Promise<void>((resolve, reject) => {
            this._db.run(`UPDATE ${t("pictures")} SET highres = ${HighresStatus.DELETED} WHERE id = ? AND highres >= ${HighresStatus.DONE}`, [
                id
            ], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
        await this._purgeAttachments();
    }

    //#endregion

    //#region Attachments management ------------------------------------------

    /** Get all attachments */
    public async getAttachments(): Promise<AttachmentDTO[]> {
        return new Promise<AttachmentDTO[]>((resolve, reject) => {
            this._db.all(`SELECT * FROM ${t("attachments")}`, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows as AttachmentDTO[]);
                }
            });
        });
    }

    /** Create an attachment and return its id */
    public async addAttachment(data: string): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            this._db.run(`INSERT INTO ${t("attachments")} (data) VALUES (?)`, [data], function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    public async getAttachment(id: number): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            this._db.get(`SELECT data FROM ${t("attachments")} WHERE id = ?`, [id], (err, row) => {
                if (err) {
                    reject(err);
                } else if (!row) {
                    reject(new Error(`Attachment ${id} not found`));
                } else {
                    resolve((row as AttachmentDTO).data);
                }
            });
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
        return new Promise<void>((resolve, reject) => {
            this._db.run(`CREATE TABLE IF NOT EXISTS ${tableName} (${Object.entries(fieldTypes).map(([fieldName, fieldType]) => `'${fieldName}' ${fieldType}`).join(", ")})`, function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    /** @returns true if column was created */
    protected _createFieldIfNeeded<TN extends TableName, T extends Tables[TN] = Tables[TN]>(tableName: TN, fieldName: keyof Required<T>, fieldType: string): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            this._db.run(`ALTER TABLE ${tableName} ADD COLUMN ${fieldName as string} ${fieldType}`, function (err) {
                if (err) {
                    // Here, this is becase the column already exists, we can ignore this error
                    resolve(false);
                } else {
                    console.info(`Column created ${tableName}.${fieldName as string}`);
                    resolve(true);
                }
            });
        });
    }

    //#endregion
}

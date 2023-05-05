import { AttachmentDTO } from "@eurekai/shared/src/types";
import { ProjectDTO, Tables, TableName, t, PromptDTO, PictureDTO, ComputationStatus } from "@eurekai/shared/src/types";
import sqlite3 from "sqlite3";

//#region Wrapper -------------------------------------------------------------

export class DatabaseWrapper {
    protected _db: sqlite3.Database;

    constructor(dbPath: string) {
        this._db = new sqlite3.Database(dbPath);
    }

    //#region General management ----------------------------------------------

    public async initIfNeeded(): Promise<void> {
        await this._createTableIfNeeded("projects", {
            "id": "INTEGER PRIMARY KEY AUTOINCREMENT",
            "name": "TEXT"
        });
        await this._createTableIfNeeded("prompts", {
            "id": "INTEGER PRIMARY KEY AUTOINCREMENT",
            "projectId": "INTEGER",
            "index": "INTEGER",
            "active": "BOOLEAN",
            "prompt": "TEXT",
            "negative_prompt": "TEXT NULL",
            "bufferSize": "INTEGER",
            "acceptedTarget": "INTEGER"
        });
        await this._createTableIfNeeded("pictures", {
            "id": "INTEGER PRIMARY KEY AUTOINCREMENT",
            "projectId": "INTEGER",
            "promptId": "INTEGER",
            "options": "TEXT", // JSON
            "createdAt": "DATE",
            "computed": "INTEGER",
            "attachmentId": "INTEGER NULL"
        });
        await this._createTableIfNeeded("attachments", {
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

    //#endregion

    //#region Projects management ---------------------------------------------

    public async getProjects(): Promise<ProjectDTO[]> {
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

    public async addProject(name: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._db.run(`INSERT INTO ${t("projects")} (name) VALUES (?)`, [name], (err) => {
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

    public async getPrompts(projectId: number): Promise<PromptDTO[]> {
        return new Promise<PromptDTO[]>((resolve, reject) => {
            this._db.all(`SELECT * FROM ${t("prompts")} WHERE projectId = ?`, [projectId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows as PromptDTO[]);
                }
            });
        });
    }

    public async addPrompt(entry: Omit<PromptDTO, "id">): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._db.run(`INSERT INTO ${t("prompts")} (projectId, index, active, prompt, negative_prompt, bufferSize, acceptedTarget) VALUES (?, ?, ?, ?, ?, ?, ?)`, [entry.projectId, entry.index, entry.active, entry.prompt, entry.negative_prompt, entry.bufferSize, entry.acceptedTarget], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    public async setPromptActive(id: number, active: boolean): Promise<void> {
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

    //#region Pictures management ---------------------------------------------

    /** Get all pictures for a project */
    public async getPictures(projectId: number, promptId?: number): Promise<PictureDTO[]> {
        return new Promise<PictureDTO[]>((resolve, reject) => {
            let query = `SELECT * FROM ${t("pictures")} WHERE projectId = ?`;
            const params = [projectId];
            if (promptId !== undefined) {
                query += " AND promptId = ?";
                params.push(promptId);
            }
            this._db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows as PictureDTO[]);
                }
            });
        });
    }

    /** Save a picture in pending state */
    public async addPicture(entry: Omit<PictureDTO, "id" | "computed">): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this._db.run(`INSERT INTO ${t("pictures")} (projectId, promptId, options, createdAt, computed, attachmentId) VALUES (?, ?, ?, ?, ?, ?)`, [entry.projectId, entry.promptId, JSON.stringify(entry.options), entry.createdAt, ComputationStatus.PENDING, entry.attachmentId], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
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
            this._db.run(`UPDATE ${t("pictures")} SET attachmentId = ?, computed = ? WHERE id = ?`, [attachmentId, ComputationStatus.ACCEPTED, id], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    /** Mark picture as accepted or rejected */
    public async setPictureStatus(id: number, status: ComputationStatus.ACCEPTED | ComputationStatus.REJECTED): Promise<void> {
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

    //#endregion

    //#region Attachments management ------------------------------------------

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
                } else {
                    resolve((row as AttachmentDTO).data);
                }
            });
        });
    }

    //#endregion

    //#region Tools -----------------------------------------------------------

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

    //#endregion
}

//#endregion

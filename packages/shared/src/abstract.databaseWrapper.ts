import { PictureDTO } from "./types";

export interface Entry extends PouchDB.Core.IdMeta, PouchDB.Core.RevisionIdMeta {
}

export type ChangeListener = () => void;

/** A generic PouchDB database wrapper with custom utility methods */
export class AbstractDatabaseWrapper<T extends Entry> {

    protected readonly _db: PouchDB.Database<T>;

    protected _replication: PouchDB.Replication.Sync<{}> | null = null;
    protected _changeListeners: ChangeListener[] = [];

    constructor(dbConstructor: ReturnType<PouchDB.Static["defaults"]>, dbName: string) {
        this._db = new dbConstructor(dbName);
    }


    /** Get an item by its id */
    public async getById(id: string): Promise<T | undefined> {
        try {
            const doc = await this._db.get(id);
            return doc ?? undefined;
        } catch (e) {
            console.warn(e);
            return undefined;
        }
    }

    /** Get all documents from the database */
    public async getAll(options?: { attachments?: boolean }): Promise<T[]> {
        const result = await this._db.allDocs({
            include_docs: true,
            ...options
        });
        return result.rows.map(row => row.doc!);
    }

    /** Erase all images */
    public async clean(filter?: (picture: T) => boolean): Promise<void> {
        const images = await this.getAll();
        for (const image of images) {
            if (filter && !filter(image)) {
                continue;
            }
            this._db.remove(image);
        }
    }

    /** 
     * Update a DTO in DB
     * Should not be used directly. Instead, you must implement other methods that will call this function.
     */
    protected async _update(doc: T): Promise<void> {
        const result = await this._db.put(doc);
        if (!result.ok) {
            throw `Failed to update ${doc._id}.${doc._rev}`;
        } else {
            doc._rev = result.rev;
        }
    }

    //#region Replication -----------------------------------------------------

    public setSync(url: string): void {
        console.debug(`Syncing to ${url}`);
        // -- Setup database replication --
        this._replication = this._db.sync(url, {
            live: true,
            retry: true
        });
        this._replication.on("change", this._fireChange.bind(this));
    }

    public addChangeListener(listener: ChangeListener): void {
        this._changeListeners.push(listener);
    }

    protected _fireChange(): void {
        for (const listener of this._changeListeners) {
            try {
                listener();
            } catch (e) {
                console.error(e);
            }
        }
    }

    //#endregion
}
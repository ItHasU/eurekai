import { PictureManager } from "@eurekai/shared/src/picture.manager";
import PouchDB from "pouchdb";
import { PictureElement } from "src/components/picture.element";

export class ClientPictureManager extends PictureManager {
    protected readonly _replication: PouchDB.Replication.Sync<{}>;

    // -- Buttons --
    protected _cleanButton: HTMLButtonElement;

    // -- Images divs --
    protected _imagesDiv: HTMLDivElement;
    protected _imagesCache: {[_id: string]: PictureElement} = {};

    constructor() {
        super(PouchDB);

        // -- Get components --
        this._cleanButton = document.getElementById("cleanButton") as HTMLButtonElement;
        this._imagesDiv = document.getElementById("imagesDiv") as HTMLDivElement;

        // -- Bind callbacks --
        this._cleanButton.addEventListener("click", this._onCleanClick.bind(this));

        // -- Setup database replication --
        this._replication = this._db.sync('http://localhost:3000/db/pictures', {
            live: true,
            retry: true,
            since: 0
        });        
        this._replication.on("change", this._refresh.bind(this));

        this._refresh();
    }

    /** Refresh images */
    protected async _refresh(): Promise<void> {
        try {
            // -- Get images --
            const images = await this.getImages();
            
            // -- Clear --
            this._imagesDiv.innerHTML = "";
            // -- Render --
            for (const image of images) {
                const existing: PictureElement | undefined = this._imagesCache[image._id];
                if (existing == null) {
                    // Not existing yet
                    const element = new PictureElement(image);
                    this._imagesDiv.append(element);
                } else {
                    // Existing
                    existing.setData(image); // Maybe image has been updated
                    this._imagesDiv.append(existing);
                }
            }
        } catch(e) {
            console.error(e);
        }
    }

    protected async _onCleanClick(): Promise<void> {
        console.log("Cleaning");
        try {
            await this.clean();
            this._refresh();
        } catch (e) {
            console.error(e);
        }
    }

}
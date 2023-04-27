import "bootstrap/dist/css/bootstrap.css";
import "bootstrap/dist/js/bootstrap.js";
import "bootstrap-icons/font/bootstrap-icons.css";

import { ClientDBConnector } from "./clientDB";
import { GeneratedImageElement } from "./generatedImage";
import { PromptElement } from "./components/prompt.element";
import { PromptManager } from "@eurekai/shared/src/prompt.manager";
import { ClientPromptManager } from "./managers/client.prompt.manager";

class App {

    // -- Components ----------------------------------------------------------
    protected _countInput: HTMLInputElement;
    protected _cleanButton: HTMLButtonElement;

    // -- Images divs --
    protected _imagesDiv: HTMLDivElement;
    protected _imagesCache: {[_id: string]: GeneratedImageElement} = {};

    // -- Database --
    protected _db: ClientDBConnector = new ClientDBConnector();
    
    protected readonly _promptsTab: ClientPromptManager = new ClientPromptManager();

    constructor() {
        this._countInput = document.getElementById("countInput") as HTMLInputElement;
        this._cleanButton = document.getElementById("cleanButton") as HTMLButtonElement;

        this._imagesDiv = document.getElementById("imagesDiv") as HTMLDivElement;

        this._init();
        this._refresh();
    }

    /** Initialize app */
    protected _init(): void {
        this._cleanButton.addEventListener("click", this._onCleanClick.bind(this));
        this._db.replication.on("change", this._refresh.bind(this));
    }

    

    /** Refresh images */
    protected async _refresh(): Promise<void> {
        try {
            // -- Get images --
            const images = await this._db.getImages();
            
            // -- Clear --
            this._imagesDiv.innerHTML = "";
            // -- Render --
            for (const image of images) {
                const existing: GeneratedImageElement | undefined = this._imagesCache[image._id];
                if (existing == null) {
                    // Not existing yet
                    const element = new GeneratedImageElement(image);
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

    //#region Callbacks

    protected async _onCleanClick(): Promise<void> {
        console.log("Cleaning");
        try {
            await this._db.clean();
            this._refresh();
        } catch (e) {
            console.error(e);
        }
    }

    //#endregion

}

const APP: App = new App();

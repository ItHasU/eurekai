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
    // -- Main form --
    protected _positiveInput: HTMLInputElement;
    protected _negativeInput: HTMLInputElement;
    protected _countInput: HTMLInputElement;
    protected _queueButton: HTMLButtonElement;
    protected _cleanButton: HTMLButtonElement;

    // -- Prompt divs --
    protected _promptsDiv: HTMLDivElement;
    protected _promptsCache: {[_id:string]: PromptElement} = {};
    protected _promptsManager: ClientPromptManager = new ClientPromptManager();

    // -- Images divs --
    protected _imagesDiv: HTMLDivElement;
    protected _imagesCache: {[_id: string]: GeneratedImageElement} = {};

    // -- Database --
    protected _db: ClientDBConnector = new ClientDBConnector();

    constructor() {
        this._positiveInput = document.getElementById("positiveInput") as HTMLInputElement;
        this._negativeInput = document.getElementById("negativeInput") as HTMLInputElement;
        this._countInput = document.getElementById("countInput") as HTMLInputElement;
        this._queueButton = document.getElementById("queueButton") as HTMLButtonElement;
        this._cleanButton = document.getElementById("cleanButton") as HTMLButtonElement;

        this._promptsDiv = document.getElementById("promptsDiv") as HTMLDivElement;
        this._imagesDiv = document.getElementById("imagesDiv") as HTMLDivElement;

        this._init();
        this._refreshPrompts();
        this._refresh();
    }

    /** Initialize app */
    protected _init(): void {
        this._queueButton.addEventListener("click", this._onQueueClick.bind(this));
        this._cleanButton.addEventListener("click", this._onCleanClick.bind(this));
        this._promptsManager.replication.on("change", this._refreshPrompts.bind(this));
        this._db.replication.on("change", this._refresh.bind(this));
    }

    /** Refresh prompts */
    protected async _refreshPrompts(): Promise<void> {
        try {
            // -- Get images --
            const prompts = await this._promptsManager.getAllPrompts();

            // -- Clear --
            this._promptsDiv.innerHTML = "";
            // -- Render --
            for (const prompt of prompts) {
                const existing: PromptElement | undefined = this._promptsCache[prompt._id];
                if (existing == null) {
                    // Not existing yet
                    const element = new PromptElement(prompt);
                    this._promptsDiv.append(element);
                } else {
                    // Existing
                    existing.setData(prompt); // Maybe image has been updated
                    this._promptsDiv.append(existing);
                }
            }
        } catch(e) {
            console.error(e);
        }

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

    protected _onQueueClick(): void {
        const positivePrompt = this._positiveInput.value;
        const negativePrompt = this._negativeInput.value;

        this._promptsManager.push(positivePrompt, negativePrompt ? undefined : negativePrompt);
    }

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



// async function main(): Promise<void> {
//   console.log("Starting db ...")
//   await db.queue([
//     { positive: "a fire ball" }
//   ], [
//     -1
//   ]);
//   const pictures = await db.getImages();
//   console.log(pictures);

//   db.refreshImages();
// }

// main().catch(e => console.error(e));